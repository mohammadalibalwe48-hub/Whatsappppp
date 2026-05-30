"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, Trash2, UserCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setName((data.user.user_metadata?.full_name as string | undefined) ?? "");
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (error) throw error;
      // Also update the profiles row so admin views see the latest.
      await apiFetch("/dashboard/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: name })
      }).catch(() => {});
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password changed");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== email) {
      toast.error("Type your email to confirm");
      return;
    }
    if (
      !confirm(
        "Permanently delete your account, API keys, OTP logs, webhooks, and WhatsApp session? This cannot be undone."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch("/dashboard/account", { method: "DELETE" });
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Settings</h1>
        <p className="text-base text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCircle className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
            <CardDescription>Update your display name and review your email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="bg-muted/20 focus-visible:ring-primary/30"
              />
            </div>
            <div className="pt-2">
              <Button onClick={save} disabled={saving || loading}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-primary" /> Change password
            </CardTitle>
            <CardDescription>
              Use a strong password. At least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-muted-foreground">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="bg-muted/20 focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="bg-muted/20 focus-visible:ring-primary/30"
              />
            </div>
            <div className="pt-2">
              <Button
                variant="secondary"
                onClick={changePassword}
                disabled={!newPassword || !confirmPassword || changingPassword}
              >
                {changingPassword ? "Changing\u2026" : "Change password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
             <ShieldCheck className="h-5 w-5 text-success" /> Security Overview
          </CardTitle>
          <CardDescription>
            We take your security seriously. Here is how we protect your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/20">
            <div className="font-semibold text-foreground/90 mb-1">OTP hashing</div>
            <p className="text-sm text-muted-foreground">bcrypt with per-record salt. Codes are only stored hashed.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/20">
            <div className="font-semibold text-foreground/90 mb-1">Rate limits</div>
            <p className="text-sm text-muted-foreground">Per-key sliding-window limits on send and verify.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/20">
            <div className="font-semibold text-foreground/90 mb-1">Audit log</div>
            <p className="text-sm text-muted-foreground">Every delivery is logged with timestamps, IP, and user agent.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/40 p-4 transition-colors hover:bg-muted/20">
            <div className="font-semibold text-foreground/90 mb-1">Row-level security</div>
            <p className="text-sm text-muted-foreground">Supabase RLS isolates every tenant automatically.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-destructive/10 border-destructive/30 bg-destructive/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-destructive">
            <AlertTriangle className="h-5 w-5" /> Danger zone
          </CardTitle>
          <CardDescription className="text-destructive/80">
            Permanently delete your account. This removes all your API keys, OTP logs,
            webhooks, and disconnects WhatsApp. Cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="deleteConfirm" className="text-destructive/90">
              Type <span className="font-mono bg-destructive/10 px-1 rounded">{email}</span> to confirm
            </Label>
            <Input
              id="deleteConfirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={email}
              className="border-destructive/40 focus-visible:ring-destructive/30 bg-background/50"
            />
          </div>
          <Button
            variant="destructive"
            onClick={deleteAccount}
            disabled={deleteConfirm !== email || deleting}
            className="shadow-md shadow-destructive/20"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting\u2026" : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
