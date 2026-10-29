"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Cable,
  CheckCircle2,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquare,
  XCircle,
  ArrowRight,
  AlertCircle,
  RefreshCw
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
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

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

export default function DashboardHome() {
  const session = useWhatsappSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<LogRow[] | null>(null);
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
      const [ov, logs] = await Promise.allSettled([
        apiFetch<{ ok: true } & Overview>("/dashboard/analytics/overview"),
        apiFetch<{ ok: true; logs: LogRow[] }>("/dashboard/otp-logs?limit=8")
      ]);
      if (cancelled) return;
      setOverview(ov.status === "fulfilled" ? ov.value : null);
      setOverviewError(ov.status === "rejected");
      setRecent(logs.status === "fulfilled" ? logs.value.logs : null);
      setRecentError(logs.status === "rejected");
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const totals = overview?.totals;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Your workspace, at a glance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Overview</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Manage conversations and keep track of OTP delivery.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button asChild><Link href="/dashboard/inbox"><Inbox aria-hidden="true" className="h-4 w-4" /> Open inbox</Link></Button>
        </div>
      </div>

      <OnboardingChecklist />
      <section aria-labelledby="quick-access-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3"><div><h2 id="quick-access-title" className="text-lg font-semibold tracking-tight">Quick access</h2><p className="mt-1 text-sm text-muted-foreground">Jump straight to the tools you use most.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAccess href="/dashboard/inbox" icon={<Inbox className="h-5 w-5" />} title="Open inbox" detail="Read and send messages" />
          <QuickAccess href="/dashboard/whatsapp" icon={<Cable className="h-5 w-5" />} title="WhatsApp connection" detail="Pair or reconnect your account" />
          <QuickAccess href="/dashboard/api-keys" icon={<KeyRound className="h-5 w-5" />} title="API keys" detail="Create and manage credentials" />
          <QuickAccess href="/dashboard/docs#mcp-access" icon={<Bot className="h-5 w-5" />} title="MCP & documentation" detail="Connect AI tools and read guides" />
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

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/10 pb-6 mb-6">
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
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : recentError ? (
            <LoadError message="We couldn’t load your recent OTPs." onRetry={() => setRefresh((value) => value + 1)} />
          ) : !recent || recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">No OTPs yet. Connect WhatsApp, create an API key, and send your first OTP.</p>
              <Button asChild variant="default" size="sm">
                <Link href="/dashboard/api-keys">
                  <KeyRound className="mr-2 h-4 w-4" /> Create API key
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-4 group hover:bg-muted/10 transition-colors -mx-4 px-4 rounded-lg">
                  <div className="flex flex-col gap-1">
                    <div className="font-medium text-foreground/90">{r.phone_number}</div>
                    <div className="text-xs text-muted-foreground/80 flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{r.app_name ?? "Default App"}</span>
                      <span>•</span>
                      <span>{formatRelative(r.created_at)}</span>
                    </div>
                  </div>
                  <Badge variant={statusVariant(r.status)} className="shadow-sm">{r.status}</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 sm:hidden">
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

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm"><AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-destructive" />{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}
