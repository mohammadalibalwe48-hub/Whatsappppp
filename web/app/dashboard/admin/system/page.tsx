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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Live readings from the API runtime. Auto-refreshes every 10s.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          icon={<Database className="h-4 w-4" />}
          title="Supabase"
          ok={info?.supabase.ready ?? false}
          pingMs={info?.supabase.pingMs ?? null}
          loading={loading}
        />
        <ServiceCard
          icon={<Wifi className="h-4 w-4" />}
          title="Redis (Upstash)"
          ok={info?.kv.ready ?? false}
          pingMs={info?.kv.pingMs ?? null}
          loading={loading}
        />
        <ServiceCard
          icon={<Server className="h-4 w-4" />}
          title="API runtime"
          ok={!!info}
          pingMs={null}
          loading={loading}
          extra={info ? `${formatUptime(info.uptimeSeconds)} · ${info.memoryMb} MB` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Runtime info
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !info ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Pair label="Environment" value={<Badge variant="secondary">{info.env}</Badge>} />
              <Pair label="Node version" value={<code>{info.nodeVersion}</code>} />
              <Pair label="API uptime" value={formatUptime(info.uptimeSeconds)} />
              <Pair label="Memory (RSS)" value={`${info.memoryMb} MB`} />
              <Pair label="WhatsApp connected" value={`${info.whatsapp.connected} / ${info.whatsapp.totalActive}`} />
              <Pair label="Sessions pairing" value={info.whatsapp.qr} />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> CORS allow-list
          </CardTitle>
          <CardDescription>
            Origins permitted to call the API. Add new sites with{" "}
            <code className="font-mono text-xs">fly secrets set API_CORS_ORIGINS=…</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !info ? (
            <Skeleton className="h-12 w-full" />
          ) : info.corsOrigins.length === 0 ? (
            <div className="text-sm text-muted-foreground">No origins configured.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {info.corsOrigins.map((o) => (
                <code
                  key={o}
                  className="rounded-md border border-border/60 bg-muted px-2 py-1 font-mono text-xs"
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
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={`grid h-10 w-10 place-items-center rounded-md ${
            ok ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            {loading
              ? "Checking…"
              : ok
                ? extra ?? (pingMs != null ? `OK · ${pingMs} ms` : "OK")
                : "Unavailable"}
          </div>
        </div>
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            ok ? "bg-green-500" : "bg-destructive"
          }`}
        />
      </CardContent>
    </Card>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
