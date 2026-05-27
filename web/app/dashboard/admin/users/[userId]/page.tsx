"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Cable,
  CheckCircle2,
  KeyRound,
  Mail,
  Shield,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative, shortPhone } from "@/lib/utils";

interface UserDetail {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  banned_until: string | null;
  isAdmin: boolean;
  adminRole: string | null;
  adminSince: string | null;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface OtpLog {
  id: string;
  phone_number: string;
  status: string;
  app_name: string | null;
  created_at: string;
  failure_reason: string | null;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

interface WhatsappSession {
  status: string;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface UserDetailResponse {
  user: UserDetail;
  apiKeys: ApiKey[];
  otpLogs: OtpLog[];
  webhooks: WebhookEndpoint[];
  whatsappSession: WhatsappSession | null;
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

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params?.userId);

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ ok: true } & UserDetailResponse>(`/admin/users/${userId}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function suspend(b: boolean) {
    if (b && !confirm(`Suspend ${data?.user.email}?`)) return;
    await act(b ? "Suspended" : "Reactivated", async () => {
      await apiFetch(`/admin/users/${userId}/suspend`, {
        method: "PATCH",
        body: JSON.stringify({ suspend: b })
      });
      await load();
    });
  }

  async function promote(role: "admin" | "super_admin") {
    if (!data) return;
    await act(`Granted ${role}`, async () => {
      await apiFetch("/admin/admins", {
        method: "POST",
        body: JSON.stringify({ userId, email: data.user.email, role })
      });
      await load();
    });
  }

  async function demote() {
    await act("Removed admin role", async () => {
      await apiFetch(`/admin/admins/${userId}`, { method: "DELETE" });
      await load();
    });
  }

  async function passwordReset() {
    await act("Password reset link emailed", async () => {
      await apiFetch(`/admin/users/${userId}/password-reset`, { method: "POST" });
    });
  }

  async function disconnectWa() {
    await act("WhatsApp session disconnected", async () => {
      await apiFetch(`/admin/sessions/${userId}/disconnect`, { method: "POST" });
      await load();
    });
  }

  async function deleteUser() {
    if (!confirm(`Permanently delete ${data?.user.email}? Cannot be undone.`)) return;
    await act("User deleted", async () => {
      await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
      router.push("/dashboard/admin/users");
    });
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key?")) return;
    await act("API key revoked", async () => {
      await apiFetch(`/admin/api-keys/${id}/revoke`, { method: "POST" });
      await load();
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {error ?? "User not found"}
        </CardContent>
      </Card>
    );
  }

  const u = data.user;
  const suspended = !!u.banned_until && new Date(u.banned_until) > new Date();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to users
      </Link>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-md border border-green-500/40 bg-green-500/5 px-3 py-2 text-sm text-green-500">
          {info}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {u.email[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {u.email}
                {u.isAdmin ? (
                  <Badge variant="default" className="gap-1">
                    {u.adminRole === "super_admin" ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : (
                      <Shield className="h-3 w-3" />
                    )}
                    {u.adminRole}
                  </Badge>
                ) : null}
                {suspended ? <Badge variant="destructive">Suspended</Badge> : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {u.full_name ?? "No name"} · joined {formatRelative(u.created_at)} · id{" "}
                <code className="font-mono">{u.id.slice(0, 8)}…</code>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={passwordReset}>
              <Mail className="mr-1 h-3.5 w-3.5" /> Reset password
            </Button>
            {!u.isAdmin ? (
              <>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => promote("admin")}>
                  <Shield className="mr-1 h-3.5 w-3.5" /> Make admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => promote("super_admin")}
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Super admin
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || u.adminRole === "super_admin"}
                onClick={demote}
                title={
                  u.adminRole === "super_admin"
                    ? "Can't demote super_admin from here"
                    : "Remove admin"
                }
              >
                <XCircle className="mr-1 h-3.5 w-3.5" /> Remove admin
              </Button>
            )}
            {suspended ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => suspend(false)}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Reactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => suspend(true)}>
                <Ban className="mr-1 h-3.5 w-3.5" /> Suspend
              </Button>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={deleteUser}>
              <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="h-4 w-4" /> WhatsApp session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data.whatsappSession ? (
              <div className="text-sm text-muted-foreground">
                No active WhatsApp session.
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <Badge variant="secondary">{data.whatsappSession.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Phone</span>
                  <span className="font-mono text-xs">
                    {data.whatsappSession.phoneNumber ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last update</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(data.whatsappSession.updatedAt)}
                  </span>
                </div>
                {data.whatsappSession.lastError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    {data.whatsappSession.lastError}
                  </div>
                ) : null}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={disconnectWa}
                  >
                    Force disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> API keys
            </CardTitle>
            <CardDescription>{data.apiKeys.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {data.apiKeys.length === 0 ? (
              <div className="text-sm text-muted-foreground">No API keys.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {data.apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <code className="font-mono">{k.prefix}…</code> · last used{" "}
                        {k.last_used_at ? formatRelative(k.last_used_at) : "never"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {k.revoked_at ? (
                        <Badge variant="outline">revoked</Badge>
                      ) : (
                        <>
                          <Badge variant="secondary">active</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => revokeKey(k.id)}
                          >
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.webhooks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No webhooks.</div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{w.url}</div>
                    <div className="text-xs text-muted-foreground">
                      events: {w.events.join(", ")} · {formatRelative(w.created_at)}
                    </div>
                  </div>
                  <Badge variant={w.active ? "secondary" : "outline"}>
                    {w.active ? "active" : "inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent OTPs</CardTitle>
          <CardDescription>Last 25 OTPs for this user</CardDescription>
        </CardHeader>
        <CardContent>
          {data.otpLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No OTPs yet.</div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.otpLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {statusBadge(l.status)}
                    <span className="font-mono text-xs">{shortPhone(l.phone_number)}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.app_name ?? "—"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(l.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
