"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  isAdmin: boolean;
  adminRole: string | null;
  adminSince: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadUsers = useCallback(async (searchQuery: string = "") => {
    setError(null);
    try {
      const qs = searchQuery ? `?search=${encodeURIComponent(searchQuery)}&limit=200` : "?limit=200";
      const data = await apiFetch<{ ok: true; users: AdminUser[]; total: number }>(
        `/admin/users${qs}`
      );
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function searchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    loadUsers(search);
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function addAdmin(u: AdminUser, role: "admin" | "super_admin") {
    await withBusy(u.id, async () => {
      await apiFetch("/admin/admins", {
        method: "POST",
        body: JSON.stringify({ userId: u.id, email: u.email, role })
      });
      await loadUsers(search);
      setInfo(`Granted ${role} to ${u.email}`);
    });
  }

  async function removeAdmin(u: AdminUser) {
    await withBusy(u.id, async () => {
      await apiFetch(`/admin/admins/${u.id}`, { method: "DELETE" });
      await loadUsers(search);
      setInfo(`Removed admin from ${u.email}`);
    });
  }

  async function suspendUser(u: AdminUser, suspend: boolean) {
    if (suspend && !confirm(`Suspend ${u.email}? They won't be able to sign in.`)) return;
    await withBusy(u.id, async () => {
      await apiFetch(`/admin/users/${u.id}/suspend`, {
        method: "PATCH",
        body: JSON.stringify({ suspend })
      });
      setInfo(suspend ? `Suspended ${u.email}` : `Reactivated ${u.email}`);
    });
  }

  async function deleteUser(u: AdminUser) {
    if (
      !confirm(
        `Permanently delete ${u.email}? This removes all their data and cannot be undone.`
      )
    ) {
      return;
    }
    await withBusy(u.id, async () => {
      await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      await loadUsers(search);
      setInfo(`Deleted ${u.email}`);
    });
  }

  async function sendPasswordReset(u: AdminUser) {
    await withBusy(u.id, async () => {
      await apiFetch(`/admin/users/${u.id}/password-reset`, { method: "POST" });
      setInfo(`Password-reset link emailed to ${u.email}`);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> All users
          </CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${users?.length ?? 0} users`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={searchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

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

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {users.map((user) => {
                const busy = busyId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/dashboard/admin/users/${user.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {user.email[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate text-sm font-medium">
                          {user.email}
                          {user.isAdmin ? (
                            <Badge variant="default" className="gap-1">
                              {user.adminRole === "super_admin" ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : (
                                <Shield className="h-3 w-3" />
                              )}
                              {user.adminRole}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.full_name ?? "No name"} · joined {formatRelative(user.created_at)}
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-1">
                      <Link href={`/dashboard/admin/users/${user.id}`}>
                        <Button variant="ghost" size="sm" title="View user">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Send password reset"
                        disabled={busy}
                        onClick={() => sendPasswordReset(user)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      {!user.isAdmin ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Promote to admin"
                            disabled={busy}
                            onClick={() => addAdmin(user, "admin")}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Promote to super_admin"
                            disabled={busy}
                            onClick={() => addAdmin(user, "super_admin")}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remove admin role"
                          disabled={busy || user.adminRole === "super_admin"}
                          onClick={() => removeAdmin(user)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Suspend"
                        disabled={busy}
                        onClick={() => suspendUser(user, true)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reactivate"
                        disabled={busy}
                        onClick={() => suspendUser(user, false)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete user"
                        disabled={busy}
                        onClick={() => deleteUser(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
