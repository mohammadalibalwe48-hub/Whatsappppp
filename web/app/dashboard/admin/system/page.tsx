"use client";

import { useEffect, useState } from "react";
import { Database, Globe, RefreshCcw, Server, Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface SystemInfo {
  env: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryMb: number;
  kv: { ready: boolean; pingMs: number | null };
  supabase: { ready: boolean; pingMs: number | null };
  corsOrigins: string[];
  whatsapp: {
    totalActive: number;
    connected: number;
    qr: number;
    disconnected: number;
  };
}

function formatUptime(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export default function AdminSystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: true; system: SystemInfo }>("/admin/system");
      setInfo(res.system);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system info");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border/40 inline-block shadow-sm">
          Live readings from the API runtime. Auto-refreshes every 10s.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shadow-sm">
          <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          icon={<Database className="h-5 w-5" />}
          title="Supabase"
          ok={info?.supabase.ready ?? false}
          pingMs={info?.supabase.pingMs ?? null}
          loading={loading}
        />
        <ServiceCard
          icon={<Wifi className="h-5 w-5" />}
          title="Redis (Upstash)"
          ok={info?.kv.ready ?? false}
          pingMs={info?.kv.pingMs ?? null}
          loading={loading}
        />
        <ServiceCard
          icon={<Server className="h-5 w-5" />}
          title="API runtime"
          ok={!!info}
          pingMs={null}
          loading={loading}
          extra={info ? `${formatUptime(info.uptimeSeconds)} · ${info.memoryMb} MB` : "—"}
        />
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-5 mb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Server className="h-5 w-5 text-primary" /> Runtime info
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !info ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm bg-muted/10 p-2 rounded-xl">
              <Pair label="Environment" value={<Badge variant="secondary" className="shadow-sm">{info.env}</Badge>} />
              <Pair label="Node version" value={<code className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border/40 text-foreground/90">{info.nodeVersion}</code>} />
              <Pair label="API uptime" value={<span className="font-medium text-foreground/90">{formatUptime(info.uptimeSeconds)}</span>} />
              <Pair label="Memory (RSS)" value={<span className="font-medium text-foreground/90">{info.memoryMb} MB</span>} />
              <Pair label="WhatsApp connected" value={<span className="font-medium text-success">{info.whatsapp.connected} / {info.whatsapp.totalActive}</span>} />
              <Pair label="Sessions pairing" value={<span className="font-medium text-warning">{info.whatsapp.qr}</span>} />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-5 mb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5 text-primary" /> CORS allow-list
          </CardTitle>
          <CardDescription className="text-base mt-1">
            Origins permitted to call the API. Add new sites with{" "}
            <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded text-foreground">fly secrets set API_CORS_ORIGINS=…</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !info ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : info.corsOrigins.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-xl text-center border border-dashed border-border/40">No origins configured.</div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {info.corsOrigins.map((o) => (
                <code
                  key={o}
                  className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 font-mono text-sm shadow-sm text-foreground/90"
                >
                  {o}
                </code>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  ok,
  pingMs,
  loading,
  extra
}: {
  icon: React.ReactNode;
  title: string;
  ok: boolean;
  pingMs: number | null;
  loading: boolean;
  extra?: string;
}) {
  const bgColor = ok ? "bg-success/10 border-success/20 shadow-success/5" : "bg-destructive/10 border-destructive/20 shadow-destructive/5";
  const iconColor = ok ? "text-success" : "text-destructive";

  return (
    <Card className={`transition-all shadow-md ${bgColor} hover:-translate-y-1`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl bg-background border border-border/40 shadow-sm ${iconColor}`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-base font-bold text-foreground/90">{title}</div>
          <div className="text-sm font-medium text-muted-foreground/90 mt-0.5">
            {loading
              ? "Checking…"
              : ok
                ? extra ?? (pingMs != null ? `OK · ${pingMs} ms` : "OK")
                : "Unavailable"}
          </div>
        </div>
        <span
          className={`inline-block h-3 w-3 rounded-full shadow-sm ${
            ok ? "bg-success shadow-success" : "bg-destructive shadow-destructive"
          }`}
        />
      </CardContent>
    </Card>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
      <dt className="text-xs uppercase font-semibold tracking-wider text-muted-foreground/80">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
