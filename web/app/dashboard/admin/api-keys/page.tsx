"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  user_id: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  default_otp_length: number | null;
  default_otp_alphabet: string | null;
  profiles?: { email: string | null; full_name: string | null } | null;
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "revoked">("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const status = filter === "all" ? "" : `&status=${filter}`;
      const res = await apiFetch<{ ok: true; apiKeys: ApiKey[]; total: number }>(
        `/admin/api-keys?limit=200${status}`
      );
      setKeys(res.apiKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function revoke(k: ApiKey) {
    if (!confirm(`Revoke "${k.name}" (${k.prefix}…)?`)) return;
    setBusy(k.id);
    try {
      await apiFetch(`/admin/api-keys/${k.id}/revoke`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> API keys (all users)
          </CardTitle>
          <CardDescription>{keys?.length ?? 0} keys</CardDescription>
        </div>
        <div className="flex gap-1 rounded-md border border-border/60 p-1">
          {(["active", "all", "revoked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 text-xs ${
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !keys || keys.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No API keys.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{k.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {k.prefix}…
                    </code>
                    {k.revoked_at ? (
                      <Badge variant="outline">revoked</Badge>
                    ) : (
                      <Badge variant="secondary">active</Badge>
                    )}
                    <Badge variant="outline">
                      {k.default_otp_length ?? 6} {k.default_otp_alphabet ?? "numeric"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {k.profiles?.email ?? k.user_id.slice(0, 8)} · created{" "}
                    {formatRelative(k.created_at)} · last used{" "}
                    {k.last_used_at ? formatRelative(k.last_used_at) : "never"}
                  </div>
                </div>
                {!k.revoked_at ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === k.id}
                    onClick={() => revoke(k)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
