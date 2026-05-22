"use client";

import { useEffect, useState } from "react";
import { Shield, UserPlus, Users, XCircle } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const data = await apiFetch<{ ok: true; users: AdminUser[] }>("/admin/users?limit=100");
      setUsers(data.users);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addAdmin(userId: string, email: string, role: "admin" | "super_admin" = "admin") {
    setActionLoading(userId);
    try {
      await apiFetch("/admin/admins", {
        method: "POST",
        body: JSON.stringify({ userId, email, role })
      });
      await loadUsers();
    } catch (err) {
      console.error("Failed to add admin:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function removeAdmin(userId: string) {
    setActionLoading(userId);
    try {
      await apiFetch(`/admin/admins/${userId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      console.error("Failed to remove admin:", err);
    } finally {
      setActionLoading(null);
    }
  }

  const filteredUsers = users?.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manage Users</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all users in your OtpWave instance.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> All Users
          </CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${filteredUsers?.length ?? 0} users`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredUsers || filteredUsers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-medium text-primary">
                        {user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.full_name ?? "No name"} · Joined {formatRelative(user.created_at)}
                      </div>
                      {user.isAdmin && user.adminSince && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Admin since {formatRelative(user.adminSince)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.isAdmin ? "default" : "secondary"}>
                      {user.isAdmin ? (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {user.adminRole}
                        </span>
                      ) : "user"}
                    </Badge>
                    {!user.isAdmin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addAdmin(user.id, user.email)}
                        disabled={actionLoading === user.id}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    ) : user.adminRole !== "super_admin" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAdmin(user.id)}
                        disabled={actionLoading === user.id}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}