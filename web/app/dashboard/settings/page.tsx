"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and review your email.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            We hash your OTP codes and your API keys at rest, sign every webhook delivery, and
            isolate your data with Postgres row-level security.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <div className="font-medium text-foreground">OTP hashing</div>
            bcrypt with per-record salt. Codes are only stored hashed.
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <div className="font-medium text-foreground">Rate limits</div>
            Per-key sliding-window limits on send and verify. Customisable per environment.
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <div className="font-medium text-foreground">Audit log</div>
            Every OTP and webhook delivery is logged with timestamps, IP, and user agent.
          </div>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <div className="font-medium text-foreground">Row-level security</div>
            Supabase RLS isolates every tenant; the API uses the service role only for writes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
