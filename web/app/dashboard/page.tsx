"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  ListChecks,
  MessageSquare,
  XCircle,
  ArrowRight
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [ov, logs] = await Promise.all([
          apiFetch<{ ok: true } & Overview>("/dashboard/analytics/overview"),
          apiFetch<{ ok: true; logs: LogRow[] }>("/dashboard/otp-logs?limit=8")
        ]);
        if (cancelled) return;
        setOverview(ov);
        setRecent(logs.logs);
      } catch {
        // surfaced in UI
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = overview?.totals;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Dashboard</h1>
        <p className="text-base text-muted-foreground mt-1">
          A real-time view of your WhatsApp OTP delivery.
        </p>
      </div>

      <OnboardingChecklist />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="OTPs sent (30d)"
          value={loading ? "—" : totals?.sent ?? 0}
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <StatCard
          label="Verified"
          value={loading ? "—" : totals?.verified ?? 0}
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
          value={loading ? "—" : totals?.failed ?? 0}
          icon={<XCircle className="h-5 w-5" />}
          trend="down"
        />
        <StatCard
          label="Pending"
          value={loading ? "—" : totals?.pending ?? 0}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Daily OTP activity</CardTitle>
            <CardDescription>Sent vs verified over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {overview ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
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
                    <Bar dataKey="sent" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar
                      dataKey="failed"
                      stackId="a"
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full w-full rounded-xl" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp session</CardTitle>
            <CardDescription>Your connection status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col">
            <div>
              {session.state ? (
                <SessionStatusPill status={session.state.status} />
              ) : (
                <Skeleton className="h-7 w-32 rounded-full" />
              )}
            </div>
            <div className="text-sm text-muted-foreground/90 leading-relaxed flex-1">
              {session.state?.phoneNumber
                ? `Connected as ${session.state.phoneNumber}`
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

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
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
          {recent === null ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : recent.length === 0 ? (
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
