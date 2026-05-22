"use client";

import { useEffect, useState } from "react";
import { Webhook, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface Endpoint {
  id: string;
  user_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
}

interface Delivery {
  id: string;
  endpoint_id: string;
  status_code: number | null;
  error: string | null;
  delivered_at: string | null;
  created_at: string;
}

export default function AdminWebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<{
          ok: true;
          endpoints: Endpoint[];
          recentDeliveries: Delivery[];
        }>("/admin/webhooks");
        if (cancelled) return;
        setEndpoints(data.endpoints);
        setDeliveries(data.recentDeliveries);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load webhooks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Webhook endpoints
          </CardTitle>
          <CardDescription>
            {endpoints?.length ?? 0} endpoints across all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !endpoints || endpoints.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No webhooks configured.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {endpoints.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{e.url}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.profiles?.email ?? e.user_id.slice(0, 8)} · events:{" "}
                      {e.events.join(", ")} · {formatRelative(e.created_at)}
                    </div>
                  </div>
                  <Badge variant={e.active ? "secondary" : "outline"}>
                    {e.active ? "active" : "inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
          <CardDescription>Last 50 attempts across all endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No deliveries yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {deliveries.map((d) => {
                const ok =
                  d.status_code && d.status_code >= 200 && d.status_code < 300;
                return (
                  <div key={d.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-3">
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono text-xs">
                        {d.status_code ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        endpoint {d.endpoint_id.slice(0, 8)}
                      </span>
                      {d.error ? (
                        <span className="truncate text-xs text-destructive">{d.error}</span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(d.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
