"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Users,
  Webhook,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalApiKeys: number;
  totalWebhooks: number;
  otpStats: {
    last30Days: {
      sent: number;
      verified: number;
      failed: number;
    };
  };
}

interface RecentLog {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  app_name: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  isAdmin: boolean;
  adminRole: string | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[] | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statsData, logsData, usersData] = await Promise.all([
          apiFetch<{ ok: true; stats: AdminStats }>("/admin/stats"),
          apiFetch<{ ok: true; logs: RecentLog[] }>("/admin/otp-logs?limit=10"),
          apiFetch<{ ok: true; users: AdminUser[] }>("/admin/users?limit=10")
        ]);
        if (cancelled) return;
        setStats(statsData.stats);
        setRecentLogs(logsData.logs);
        setUsers(usersData.users);
      } catch (err) {
        console.error("Failed to load admin data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const otpStats = stats?.otpStats.last30Days;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitor and manage your OtpWave instance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalAdmins ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalApiKeys ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OTPs Sent (30d)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{otpStats?.sent ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* OTP Performance */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {otpStats?.verified ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {otpStats?.failed ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-muted-foreground" /> Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalWebhooks ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent OTP Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Recent OTP Logs
            </CardTitle>
            <CardDescription>Latest OTP requests across all users.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/admin/logs">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentLogs === null ? (
            <Skeleton className="h-32 w-full" />
          ) : recentLogs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No OTP logs yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{log.phone_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.app_name ?? "—"} · {formatRelative(log.created_at)}
                    </div>
                  </div>
                  <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Recent Users
            </CardTitle>
            <CardDescription>Latest registered users.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/admin/users">Manage all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {users === null ? (
            <Skeleton className="h-32 w-full" />
          ) : users.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No users yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.full_name ?? "—"} · Joined {formatRelative(user.created_at)}
                    </div>
                  </div>
                  <Badge variant={user.isAdmin ? "default" : "secondary"}>
                    {user.isAdmin ? user.adminRole : "user"}
                  </Badge>
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