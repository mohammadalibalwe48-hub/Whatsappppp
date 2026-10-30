"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Cable,
  CheckCircle2,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquare,
  XCircle,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Server,
  Database,
  Radio,
  Sparkles,
  Send
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { StatCard } from "@/components/dashboard/stat-card";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SessionStatusPill } from "@/components/dashboard/session-status-pill";
import { useWhatsappSession } from "@/lib/hooks/use-session";
import { apiFetch, apiUrl } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import { GlassOrbCluster } from "@/components/glass-orb-cluster";

interface Overview {
  totals: { sent: number; verified: number; failed: number; expired: number; pending: number };
  verificationRate: number;
  series: { date: string; sent: number; verified: number; failed: number }[];
}

interface LogRow {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  verified_at: string | null;
  app_name: string | null;
}

interface ApiHealth {
  ok: boolean;
  service: string;
  kvReady: boolean;
  supabaseConfigured: boolean;
  time: string;
}

export default function DashboardHome() {
  const session = useWhatsappSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<LogRow[] | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [recentError, setRecentError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setOverviewError(false);
      setRecentError(false);
      setHealthError(false);
      const [ov, logs, health] = await Promise.allSettled([
        apiFetch<{ ok: true } & Overview>("/dashboard/analytics/overview"),
        apiFetch<{ ok: true; logs: LogRow[] }>("/dashboard/otp-logs?limit=8"),
        fetch(`${apiUrl}/health`, { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("API health check failed");
          return await response.json() as ApiHealth;
        })
      ]);
      if (cancelled) return;
      setOverview(ov.status === "fulfilled" ? ov.value : null);
      setOverviewError(ov.status === "rejected");
      setRecent(logs.status === "fulfilled" ? logs.value.logs : null);
      setRecentError(logs.status === "rejected");
      setApiHealth(health.status === "fulfilled" ? health.value : null);
      setHealthError(health.status === "rejected");
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const totals = overview?.totals;
  const serviceStatus = apiHealth?.ok ? "Operational" : healthError ? "Unavailable" : "Checking";
  const storeStatus = apiHealth ? apiHealth.kvReady ? "Ready" : "Degraded" : healthError ? "Unknown" : "Checking";
  const whatsAppStatus = session.state?.status === "connected"
    ? "Connected"
    : session.loading
      ? "Checking"
      : session.state?.status === "qr" || session.state?.status === "pairing"
        ? "Pairing"
        : session.state?.status === "error"
          ? "Needs attention"
          : "Disconnected";

  return (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b0a09] p-5 text-[#f2eeeb] shadow-2xl shadow-black/20 sm:p-7 lg:p-8" aria-labelledby="overview-title">
        <div aria-hidden="true" className="halftone-band absolute -right-8 top-[14%] h-12 w-[66%] opacity-50" />
        <div aria-hidden="true" className="halftone-band absolute -bottom-1 left-0 h-14 w-full opacity-45" />
        <div className="pointer-events-none absolute -right-8 -top-28 -z-10 h-80 w-80 rounded-full bg-primary/[0.08] blur-3xl" />
        <GlassOrbCluster className="absolute -right-10 top-2 hidden h-[310px] w-[350px] opacity-75 lg:block" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] text-[#d2c8c2]"><Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" /> Messaging + verification operations</div>
            <h1 id="overview-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Operations</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#a89e98]">A live view of your WhatsApp connection, OTP delivery, and developer workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href="/dashboard/playground"><Send aria-hidden="true" className="h-4 w-4" /> Send a test OTP</Link></Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/[0.035] text-white hover:bg-white/10 hover:text-white"><Link href="/dashboard/inbox"><Inbox aria-hidden="true" className="h-4 w-4" /> Open inbox</Link></Button>
            <Button type="button" variant="ghost" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="text-[#c5bbb5] hover:bg-white/10 hover:text-white">
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
        <div className="mt-7 grid gap-2 border-t border-white/10 pt-5 sm:grid-cols-3">
          <HealthTile icon={<Server className="h-4 w-4" />} label="API service" value={serviceStatus} detail={healthError ? "Could not reach the API" : "Public API + dashboard"} good={!!apiHealth?.ok} pending={!apiHealth && !healthError} />
          <HealthTile icon={<Database className="h-4 w-4" />} label="OTP store" value={storeStatus} detail={apiHealth?.kvReady ? "Ready to handle requests" : "OTP delivery state"} good={!!apiHealth?.kvReady} pending={!apiHealth && !healthError} />
          <HealthTile icon={<Radio className="h-4 w-4" />} label="WhatsApp account" value={whatsAppStatus} detail={session.state?.phoneNumber ? `+${session.state.phoneNumber.replace(/^\+/, "")}` : "Pair a number to send OTPs"} good={session.state?.status === "connected"} pending={session.loading} />
        </div>
      </section>

      <OnboardingChecklist />
      <section aria-labelledby="quick-access-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3"><div><h2 id="quick-access-title" className="text-lg font-semibold tracking-tight">Quick actions</h2><p className="mt-1 text-sm text-muted-foreground">Jump into a task without losing your place.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAccess href="/dashboard/inbox" icon={<Inbox className="h-5 w-5" />} title="Open inbox" detail="Read and send messages" />
          <QuickAccess href="/dashboard/whatsapp" icon={<Cable className="h-5 w-5" />} title="WhatsApp connection" detail="Pair or reconnect your account" />
          <QuickAccess href="/dashboard/api-keys" icon={<KeyRound className="h-5 w-5" />} title="Manage API keys" detail="Create or rotate credentials" />
          <QuickAccess href="/dashboard/logs" icon={<ListChecks className="h-5 w-5" />} title="Delivery activity" detail="Inspect recent OTP events" />
        </div>
      </section>

      <section aria-labelledby="delivery-summary-title" className="space-y-3" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="delivery-summary-title" className="text-lg font-semibold tracking-tight">Delivery summary</h2>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">Last 30 days</span>
        </div>
        {overviewError && <LoadError message="We couldn’t load your delivery summary." onRetry={() => setRefresh((value) => value + 1)} />}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="OTPs sent"
            value={loading || overviewError ? "—" : totals?.sent ?? 0}
            icon={<MessageSquare className="h-5 w-5" />}
          />
          <StatCard
            label="Verified"
            value={loading || overviewError ? "—" : totals?.verified ?? 0}
            icon={<CheckCircle2 className="h-5 w-5" />}
            trend="up"
            hint={
              overview
                ? `${(overview.verificationRate * 100).toFixed(1)}% verification rate`
                : undefined
            }
          />
          <StatCard
            label="Failed"
            value={loading || overviewError ? "—" : totals?.failed ?? 0}
            icon={<XCircle className="h-5 w-5" />}
            trend="down"
          />
          <StatCard
            label="Pending"
            value={loading || overviewError ? "—" : totals?.pending ?? 0}
            icon={<Activity className="h-5 w-5" />}
          />
        </div>

      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Daily OTP activity</CardTitle>
            <CardDescription>Total OTPs sent and successfully verified each day.</CardDescription>
            <div className="flex gap-4 pt-2 text-xs text-muted-foreground" aria-label="Chart legend">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Sent</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-foreground/40" /> Verified</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : overviewError ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">Activity is unavailable. Try refreshing above.</div>
              ) : overview && overview.totals.sent > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      minTickGap={28}
                      tickFormatter={(value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                        color: "hsl(var(--foreground))"
                      }}
                    />
                    <Bar name="Sent" dataKey="sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar
                      name="Verified"
                      dataKey="verified"
                      fill="hsl(var(--foreground) / 0.4)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-5 text-center">
                  <Activity aria-hidden="true" className="mb-3 h-7 w-7 text-primary" />
                  <p className="text-sm font-semibold">Your activity starts here</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">Send a test OTP to see your delivery activity.</p>
                  <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/dashboard/playground">Try the playground <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp session</CardTitle>
            <CardDescription>Your connection status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col">
            <div>
              {session.state ? (
                <SessionStatusPill status={session.state.status} />
              ) : session.loading ? (
                <Skeleton className="h-7 w-32 rounded-full" />
              ) : <Badge variant="warning">Status unavailable</Badge>}
            </div>
            <div className="text-sm text-muted-foreground/90 leading-relaxed flex-1">
              {session.state?.phoneNumber
                ? `Connected as ${session.state.phoneNumber}`
                : !session.loading && !session.state
                  ? "We couldn’t check your connection. Open connection settings to try again."
                  : "Connect a WhatsApp account to start sending OTPs."}
            </div>
            <Button asChild variant="outline" className="w-full justify-between group">
              <Link href="/dashboard/whatsapp">
                Manage connection
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border bg-card shadow-sm">
        <CardHeader className="mb-0 flex flex-row items-center justify-between border-b border-border pb-5">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="h-5 w-5 text-primary" /> Recent OTPs
            </CardTitle>
            <CardDescription className="mt-1">Latest deliveries across all of your API keys.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/logs">View all logs <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : recentError ? (
            <div className="p-6"><LoadError message="We couldn’t load your recent OTPs." onRetry={() => setRefresh((value) => value + 1)} /></div>
          ) : !recent || recent.length === 0 ? (
            <div className="m-6 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Activity className="h-5 w-5" /></div>
              <p className="mt-3 text-sm font-semibold">Your delivery stream is ready</p>
              <p className="mx-auto mb-4 mt-1 max-w-sm text-sm text-muted-foreground">Create a key and send a test to see OTP events, delivery status, and verification activity here.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm"><Link href="/dashboard/api-keys"><KeyRound className="mr-2 h-4 w-4" /> Create API key</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/dashboard/playground"><Send className="mr-2 h-4 w-4" /> Test delivery</Link></Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <tr><th scope="col" className="px-6 py-3">Recipient</th><th scope="col" className="px-4 py-3">Application</th><th scope="col" className="px-4 py-3">Created</th><th scope="col" className="px-6 py-3 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {recent.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium tabular-nums text-foreground">{r.phone_number}</td>
                      <td className="max-w-48 truncate px-4 py-4 text-muted-foreground">{r.app_name ?? "Default App"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatRelative(r.created_at)}</td>
                      <td className="px-6 py-4 text-right"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-border p-4 sm:hidden">
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/logs">View all logs</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function statusVariant(status: string): "default" | "success" | "warning" | "destructive" {
  if (status === "verified") return "success";
  if (status === "pending") return "warning";
  if (status === "failed" || status === "expired") return "destructive";
  return "default";
}

function QuickAccess({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex min-h-[88px] items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function HealthTile({ icon, label, value, detail, good, pending }: { icon: React.ReactNode; label: string; value: string; detail: string; good: boolean; pending?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 sm:px-4">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${good ? "bg-primary/10 text-primary" : pending ? "bg-white/[0.06] text-[#b7ada7]" : "bg-[#5f3b30]/35 text-[#e1a58e]"}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-[#a99f99]">{label}</span><span className="mt-0.5 block truncate text-sm font-semibold text-white">{pending ? "Checking…" : value}</span><span className="mt-0.5 block truncate text-[10px] text-[#817772]">{detail}</span></span>
      <span aria-label={good ? "Healthy" : pending ? "Checking" : "Needs attention"} className={`h-2 w-2 shrink-0 rounded-full ${good ? "bg-primary" : pending ? "animate-pulse bg-[#817772]" : "bg-[#cc896e]"}`} />
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm"><AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive" />{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}
