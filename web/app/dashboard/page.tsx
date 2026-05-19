"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  KeyRound,
  ListChecks,
  MessageSquare,
  XCircle
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A real-time view of your WhatsApp OTP delivery.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="OTPs sent (30d)"
          value={loading ? "—" : totals?.sent ?? 0}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Verified"
          value={loading ? "—" : totals?.verified ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
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
          icon={<XCircle className="h-4 w-4" />}
          trend="down"
        />
        <StatCard
          label="Pending"
          value={loading ? "—" : totals?.pending ?? 0}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily OTP activity</CardTitle>
            <CardDescription>Sent vs verified over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {overview ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: 8
                      }}
                    />
                    <Bar dataKey="sent" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="failed"
                      stackId="a"
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp session</CardTitle>
            <CardDescription>Your connection status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.state ? (
              <SessionStatusPill status={session.state.status} />
            ) : (
              <Skeleton className="h-5 w-32" />
            )}
            <div className="text-sm text-muted-foreground">
              {session.state?.phoneNumber
                ? `Connected as ${session.state.phoneNumber}`
                : "Connect a WhatsApp account to start sending OTPs."}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/whatsapp">Manage connection</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Recent OTPs
            </CardTitle>
            <CardDescription>Latest deliveries across all of your API keys.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/logs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent === null ? (
            <Skeleton className="h-32 w-full" />
          ) : recent.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No OTPs yet. Connect WhatsApp, create an API key, and send your first OTP.
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <Link href="/dashboard/api-keys" className="inline-flex items-center gap-1 text-primary">
                  <KeyRound className="h-3 w-3" /> Create an API key
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{r.phone_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.app_name ?? "—"} · {formatRelative(r.created_at)}
                    </div>
                  </div>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
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
