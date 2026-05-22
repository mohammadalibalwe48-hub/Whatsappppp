"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clock,
  KeyRound,
  ListChecks,
  Server,
  Users,
  Webhook
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatRelative, shortPhone } from "@/lib/utils";

interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalApiKeys: number;
  totalWebhooks: number;
  otpsLast24h: number;
  verificationRate: number;
  otpStats: {
    last30Days: {
      sent: number;
      verified: number;
      failed: number;
      expired: number;
      pending: number;
    };
  };
}

interface SystemInfo {
  env: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryMb: number;
  kv: { ready: boolean; pingMs: number | null };
  supabase: { ready: boolean; pingMs: number | null };
  whatsapp: {
    totalActive: number;
    connected: number;
    qr: number;
    disconnected: number;
  };
}

interface RecentLog {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  app_name: string | null;
  profiles?: { email: string | null } | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/15">verified</Badge>;
    case "pending":
      return <Badge variant="secondary">pending</Badge>;
    case "expired":
      return <Badge variant="outline">expired</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatUptime(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statsData, systemData, logsData] = await Promise.all([
          apiFetch<{ ok: true; stats: AdminStats }>("/admin/stats"),
          apiFetch<{ ok: true; system: SystemInfo }>("/admin/system"),
          apiFetch<{ ok: true; logs: RecentLog[] }>("/admin/otp-logs?limit=10")
        ]);
        if (cancelled) return;
        setStats(statsData.stats);
        setSystem(systemData.system);
        setRecentLogs(logsData.logs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load admin data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const otp = stats?.otpStats.last30Days;

  return (
    <div className="space-y-6">
      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={loading ? "—" : (stats?.totalUsers ?? 0).toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="OTPs sent (24h)"
          value={loading ? "—" : (stats?.otpsLast24h ?? 0).toLocaleString()}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Verification rate (30d)"
          value={loading ? "—" : `${((stats?.verificationRate ?? 0) * 100).toFixed(1)}%`}
          hint={otp ? `${otp.verified.toLocaleString()} / ${otp.sent.toLocaleString()} verified` : undefined}
          trend={
            stats && stats.verificationRate >= 0.8
              ? "up"
              : stats && stats.verificationRate < 0.5
                ? "down"
                : "neutral"
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Active API keys"
          value={loading ? "—" : (stats?.totalApiKeys ?? 0).toLocaleString()}
          hint={
            stats ? `${stats.totalAdmins} admins · ${stats.totalWebhooks} webhooks` : undefined
          }
          icon={<KeyRound className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> 30-day OTP breakdown
            </CardTitle>
            <CardDescription>Across every user on this instance.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !otp ? (
              <div className="grid grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <BreakdownCell label="Sent" value={otp.sent} tone="default" />
                <BreakdownCell label="Verified" value={otp.verified} tone="success" />
                <BreakdownCell label="Pending" value={otp.pending} tone="muted" />
                <BreakdownCell label="Expired" value={otp.expired} tone="muted" />
                <BreakdownCell label="Failed" value={otp.failed} tone="danger" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" /> System health
            </CardTitle>
            <CardDescription>Live status of the API runtime.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !system ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <ul className="space-y-3 text-sm">
                <SystemRow
                  label="Redis"
                  ok={system.kv.ready}
                  detail={system.kv.pingMs != null ? `${system.kv.pingMs} ms` : "—"}
                />
                <SystemRow
                  label="Supabase"
                  ok={system.supabase.ready}
                  detail={
                    system.supabase.pingMs != null ? `${system.supabase.pingMs} ms` : "—"
                  }
                />
                <SystemRow
                  label="WhatsApp sessions"
                  ok={system.whatsapp.connected > 0 || system.whatsapp.totalActive === 0}
                  detail={`${system.whatsapp.connected} connected · ${system.whatsapp.totalActive} total`}
                />
                <SystemRow
                  label="API uptime"
                  ok={true}
                  detail={formatUptime(system.uptimeSeconds)}
                />
                <li className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Node {system.nodeVersion}</span>
                  <span>{system.memoryMb} MB RSS</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" /> Recent OTPs
            </CardTitle>
            <CardDescription>Last 10 OTPs across all users.</CardDescription>
          </div>
          <Link href="/dashboard/admin/otp-logs">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !recentLogs || recentLogs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No OTPs sent yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    {statusBadge(l.status)}
                    <span className="font-mono text-xs">{shortPhone(l.phone_number)}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.app_name ?? "—"}
                    </span>
                    {l.profiles?.email ? (
                      <span className="text-xs text-muted-foreground">· {l.profiles.email}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatRelative(l.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink
          href="/dashboard/admin/users"
          icon={<Users className="h-4 w-4" />}
          title="Manage users"
          desc="Search, suspend, delete, promote to admin."
        />
        <QuickLink
          href="/dashboard/admin/sessions"
          icon={<Cable className="h-4 w-4" />}
          title="WhatsApp sessions"
          desc="See every paired phone and disconnect them."
        />
        <QuickLink
          href="/dashboard/admin/webhooks"
          icon={<Webhook className="h-4 w-4" />}
          title="Webhooks"
          desc="Inspect endpoints and delivery history."
        />
      </div>
    </div>
  );
}

function BreakdownCell({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "danger" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-green-500"
      : tone === "danger"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function SystemRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            ok ? "bg-green-500" : "bg-destructive"
          }`}
        />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </li>
  );
}

function QuickLink({
  href,
  icon,
  title,
  desc
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-start gap-3 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
