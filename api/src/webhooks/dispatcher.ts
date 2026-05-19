import { signWebhook } from "../lib/crypto";
import { logger } from "../lib/logger";
import { getSupabase, supabaseAvailable } from "../lib/supabase";

export type WebhookEvent =
  | "otp.sent"
  | "otp.verified"
  | "otp.failed"
  | "whatsapp.connected"
  | "whatsapp.disconnected"
  | "api.limit_warning";

interface WebhookJob {
  userId: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
}

const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000];

interface EndpointRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

async function fetchEndpoints(userId: string, event: WebhookEvent): Promise<EndpointRow[]> {
  if (!supabaseAvailable()) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("id,url,secret,events,active")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) {
    logger.warn({ err: error, userId }, "Failed to fetch webhook endpoints");
    return [];
  }
  return (data ?? []).filter((e) => !e.events?.length || e.events.includes(event));
}

async function recordDelivery(args: {
  userId: string;
  endpointId: string;
  event: string;
  payload: string;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
  attempt: number;
  delivered: boolean;
}) {
  if (!supabaseAvailable()) return;
  try {
    const supabase = getSupabase();
    await supabase.from("webhook_deliveries").insert({
      user_id: args.userId,
      endpoint_id: args.endpointId,
      event: args.event,
      payload: args.payload,
      status_code: args.statusCode,
      response_body: args.responseBody?.slice(0, 2000) ?? null,
      error: args.error,
      attempt: args.attempt,
      delivered: args.delivered
    });
  } catch (err) {
    logger.warn({ err }, "Failed to record webhook delivery");
  }
}

async function attemptDelivery(endpoint: EndpointRow, job: WebhookJob, attempt: number) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payloadObj = {
    id: `wh_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    event: job.event,
    created_at: new Date().toISOString(),
    data: job.data
  };
  const payload = JSON.stringify(payloadObj);
  const signature = signWebhook(payload, endpoint.secret, timestamp);

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-otpwave-signature": `t=${timestamp},v1=${signature}`,
        "x-otpwave-event": job.event,
        "user-agent": "OtpWave-Webhook/1.0"
      },
      body: payload,
      signal: AbortSignal.timeout(10_000)
    });
    const responseBody = await res.text().catch(() => "");
    const delivered = res.ok;
    await recordDelivery({
      userId: job.userId,
      endpointId: endpoint.id,
      event: job.event,
      payload,
      statusCode: res.status,
      responseBody,
      error: delivered ? null : `HTTP ${res.status}`,
      attempt,
      delivered
    });
    return delivered;
  } catch (err) {
    const message = (err as Error).message ?? "Webhook delivery failed";
    await recordDelivery({
      userId: job.userId,
      endpointId: endpoint.id,
      event: job.event,
      payload,
      statusCode: null,
      responseBody: null,
      error: message,
      attempt,
      delivered: false
    });
    return false;
  }
}

async function deliverWithRetries(endpoint: EndpointRow, job: WebhookJob) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ok = await attemptDelivery(endpoint, job, attempt);
    if (ok) return;
    const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
    await new Promise((r) => setTimeout(r, backoff));
  }
  logger.warn({ event: job.event, endpoint: endpoint.id }, "Webhook gave up after max retries");
}

/**
 * Fire-and-forget webhook enqueue. Lookups + delivery happen asynchronously
 * so the request handler returns immediately.
 */
export function enqueueWebhook(job: WebhookJob): void {
  setImmediate(async () => {
    try {
      const endpoints = await fetchEndpoints(job.userId, job.event);
      await Promise.all(endpoints.map((e) => deliverWithRetries(e, job)));
    } catch (err) {
      logger.warn({ err, event: job.event }, "Webhook dispatcher error");
    }
  });
}
