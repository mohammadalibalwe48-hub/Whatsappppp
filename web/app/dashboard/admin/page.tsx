"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Cable, CheckCircle2, Clock, KeyRound, ListChecks, Server, Users, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { formatRelative, formatUptime, shortPhone } from "@/lib/utils";

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
  kv: { ready: boolean; pingMs: number | null };
  supabase: { ready: boolean; pingMs: number | null };
  whatsapp: { connected: number; totalActive: number };
  uptimeSeconds: number;
  memoryMb: string;
  nodeVersion: string;
}

interface RecentLog {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  app_name: string | null;
  profiles: { email: string } | null;
}

function statusBadge(status: string) {
  if (status === "verified") return <Badge variant="success" className="h-5">Verified</Badge>;
  if (status === "pending") return <Badge variant="warning" className="h-5">Pending</Badge>;
  if (status === "failed" || status === "expired") return <Badge variant="destructive" className="h-5">{status}</Badge>;
  return <Badge variant="secondary" className="h-5">{status}</Badge>;
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
    <div className="space-y-8">
      {error ? (
        <Card className="shadow-sm border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm font-medium text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={loading ? "—" : (stats?.totalUsers ?? 0).toLocaleString()}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="OTPs sent (24h)"
          value={loading ? "—" : (stats?.otpsLast24h ?? 0).toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
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
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Active API keys"
          value={loading ? "—" : (stats?.totalApiKeys ?? 0).toLocaleString()}
          hint={
            stats ? `${stats.totalAdmins} admins · ${stats.totalWebhooks} webhooks` : undefined
          }
          icon={<KeyRound className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-primary" /> 30-day OTP breakdown
            </CardTitle>
            <CardDescription className="text-base mt-1">Across every user on this instance.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !otp ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <BreakdownCell label="Sent" value={otp.sent} tone="default" />
                <BreakdownCell label="Verified" value={otp.verified} tone="success" />
                <BreakdownCell label="Pending" value={otp.pending} tone="muted" />
                <BreakdownCell label="Expired" value={otp.expired} tone="muted" />
                <BreakdownCell label="Failed" value={otp.failed} tone="danger" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Server className="h-5 w-5 text-primary" /> System health
            </CardTitle>
            <CardDescription className="text-base mt-1">Live status of the API runtime.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !system ? (
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <ul className="space-y-4 text-sm">
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
                <li className="flex items-center justify-between text-xs font-medium text-muted-foreground/80 pt-2 border-t border-border/40">
                  <span>Node {system.nodeVersion}</span>
                  <span>{system.memoryMb} MB RSS</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/10 pb-6 mb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListChecks className="h-5 w-5 text-primary" /> Recent OTPs
            </CardTitle>
            <CardDescription className="mt-1">Last 10 OTPs across all users.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shadow-sm hidden sm:flex">
             <Link href="/dashboard/admin/otp-logs">View all logs</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !recentLogs || recentLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center text-sm text-muted-foreground">
              No OTPs sent yet.
            </div>
          ) : (
            <div className="divide-y divide-border/40 -mx-6 px-2">
              {recentLogs.map((l) => (
                <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 group hover:bg-muted/10 transition-colors rounded-xl">
                  <div className="flex items-center gap-4 mb-2 sm:mb-0">
                    {statusBadge(l.status)}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                       <span className="font-mono text-sm font-semibold">{shortPhone(l.phone_number)}</span>
                       <span className="hidden sm:inline text-muted-foreground/40">•</span>
                       <span className="text-sm text-muted-foreground/90 font-medium">
                         {l.app_name ?? "—"}
                       </span>
                       {l.profiles?.email ? (
                         <>
                           <span className="hidden sm:inline text-muted-foreground/40">•</span>
                           <span className="text-xs text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded">{l.profiles.email}</span>
                         </>
                       ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 self-start sm:self-center">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelative(l.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 sm:hidden">
             <Button asChild variant="outline" className="w-full">
               <Link href="/dashboard/admin/otp-logs">View all logs</Link>
             </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        <QuickLink
          href="/dashboard/admin/users"
          icon={<Users className="h-5 w-5" />}
          title="Manage users"
          desc="Search, suspend, delete, promote to admin."
        />
        <QuickLink
          href="/dashboard/admin/sessions"
          icon={<Cable className="h-5 w-5" />}
          title="WhatsApp sessions"
          desc="See every paired phone and disconnect them."
        />
        <QuickLink
          href="/dashboard/admin/webhooks"
          icon={<Webhook className="h-5 w-5" />}
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
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : tone === "muted"
          ? "text-muted-foreground/80"
          : "text-foreground/90";

  const bg = tone === "success" ? "bg-success/5" : tone === "danger" ? "bg-destructive/5" : "bg-card/40";
  const border = tone === "success" ? "border-success/20" : tone === "danger" ? "border-destructive/20" : "border-border/40";

  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 text-center transition-colors hover:bg-muted/30 shadow-sm`}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function SystemRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-center justify-between py-1">
      <span className="flex items-center gap-3 font-medium text-foreground/90">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full shadow-sm ${
            ok ? "bg-success shadow-success/40" : "bg-destructive shadow-destructive/40"
          }`}
        />
        {label}
      </span>
      <span className="text-sm font-mono text-muted-foreground/90 bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">{detail}</span>
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
      <Card className="transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 h-full shadow-md shadow-black/5 bg-card/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm shadow-primary/10">
            {icon}
          </div>
          <div>
            <div className="text-base font-bold text-foreground/90 mb-1">{title}</div>
            <div className="text-sm text-muted-foreground/90 leading-relaxed">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
