"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Plus, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

const EVENT_OPTIONS = [
  "otp.sent",
  "otp.verified",
  "otp.failed",
  "whatsapp.connected",
  "whatsapp.disconnected",
  "api.limit_warning"
] as const;

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export default function WebhooksPage() {
  const [items, setItems] = useState<Endpoint[] | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["otp.sent", "otp.verified"]);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ url: string; secret: string } | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ ok: true; webhooks: Endpoint[] }>("/dashboard/webhooks");
      setItems(res.webhooks);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load webhooks");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWebhook() {
    if (!url.trim()) return toast.error("URL is required");
    if (events.length === 0) return toast.error("Choose at least one event");
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: true; webhook: Endpoint; secret: string }>(
        "/dashboard/webhooks",
        {
          method: "POST",
          body: JSON.stringify({ url: url.trim(), events })
        }
      );
      setOpen(false);
      setUrl("");
      setEvents(["otp.sent", "otp.verified"]);
      setRevealed({ url: res.webhook.url, secret: res.secret });
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create webhook");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await apiFetch(`/dashboard/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active })
      });
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update webhook");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this webhook?")) return;
    try {
      await apiFetch(`/dashboard/webhooks/${id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete webhook");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Receive realtime callbacks when OTP and session events happen.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Endpoints
          </CardTitle>
          <CardDescription>
            Every delivery is signed with HMAC-SHA256. Verify the <code>x-otpwave-signature</code>{" "}
            header on your side.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <Skeleton className="h-32 w-full" />
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No webhooks configured.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {items.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="break-all font-medium">{w.url}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-[10px]">
                          {e}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {formatRelative(w.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={w.active}
                      onCheckedChange={(v) => toggle(w.id, v)}
                      aria-label="Toggle webhook"
                    />
                    <Button variant="ghost" size="icon" onClick={() => remove(w.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New webhook endpoint</DialogTitle>
            <DialogDescription>
              We&apos;ll POST a JSON payload to this URL whenever a subscribed event fires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.mysite.com/otpwave/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_OPTIONS.map((event) => {
                  const checked = events.includes(event);
                  return (
                    <label
                      key={event}
                      className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm"
                    >
                      <span>{event}</span>
                      <Switch
                        checked={checked}
                        onCheckedChange={(v) =>
                          setEvents((prev) =>
                            v ? Array.from(new Set([...prev, event])) : prev.filter((e) => e !== event)
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your signing secret</DialogTitle>
            <DialogDescription>
              Use this secret to verify the HMAC signature of incoming webhook deliveries.
            </DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="space-y-3">
              <div className="text-sm font-medium break-all">{revealed.url}</div>
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs">
                <span className="flex-1 break-all">{revealed.secret}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed.secret);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>I&apos;ve saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
