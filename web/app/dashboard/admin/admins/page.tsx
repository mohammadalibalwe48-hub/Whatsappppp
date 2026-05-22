"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface AdminRow {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "super_admin";
  created_at: string;
  created_by: string | null;
  profiles?: { email: string | null; full_name: string | null } | null;
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ ok: true; admins: AdminRow[] }>("/admin/admins");
      setAdmins(data.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(a: AdminRow, role: "admin" | "super_admin") {
    setBusy(a.user_id);
    setError(null);
    try {
      await apiFetch(`/admin/admins/${a.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: AdminRow) {
    if (!confirm(`Remove admin role from ${a.email}?`)) return;
    setBusy(a.user_id);
    setError(null);
    try {
      await apiFetch(`/admin/admins/${a.user_id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Admins
        </CardTitle>
        <CardDescription>
          {admins?.length ?? 0} users with elevated access. Promote regular users from the{" "}
          <Link href="/dashboard/admin/users" className="underline">
            Users
          </Link>{" "}
          tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !admins || admins.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No admins yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {admins.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/dashboard/admin/users/${a.user_id}`}
                  className="flex min-w-0 items-center gap-3 hover:opacity-90"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {a.email[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{a.email}</span>
                      <Badge variant="default" className="gap-1">
                        {a.role === "super_admin" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {a.role}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Since {formatRelative(a.created_at)}
                    </div>
                  </div>
                </Link>
                <div className="flex gap-2">
                  {a.role === "admin" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === a.user_id}
                      onClick={() => changeRole(a, "super_admin")}
                    >
                      Promote
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === a.user_id}
                      onClick={() => changeRole(a, "admin")}
                    >
                      Demote
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === a.user_id}
                    onClick={() => remove(a)}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
