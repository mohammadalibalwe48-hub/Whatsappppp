"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Plus, Trash2, Webhook, BellRing } from "lucide-react";
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Webhooks</h1>
          <p className="text-base text-muted-foreground mt-1">
            Receive realtime callbacks when OTP and session events happen.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="shadow-sm shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> New webhook
        </Button>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-6 mb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Webhook className="h-5 w-5 text-primary" /> Endpoints
          </CardTitle>
          <CardDescription className="mt-1">
            Every delivery is signed with HMAC-SHA256. Verify the <code className="bg-muted px-1 rounded text-foreground">x-otpwave-signature</code>{" "}
            header on your side.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? (
            <div className="space-y-4 pt-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center mt-4">
               <BellRing className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">No webhooks configured. Create one to receive realtime updates.</p>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                Add an endpoint
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40 -mx-6 mt-2">
              {items.map((w) => (
                <div key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 group hover:bg-muted/10 transition-colors">
                  <div className="space-y-3 mb-4 sm:mb-0">
                    <div className="break-all font-semibold text-foreground/90 text-lg flex items-center gap-2">
                       {w.url}
                       {!w.active && <Badge variant="secondary" className="h-5 text-[10px]">Inactive</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {w.events.map((e) => (
                        <Badge key={e} variant="secondary" className="bg-muted border-border/40 text-[10px] text-muted-foreground">
                          {e}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground/80">
                      Created {formatRelative(w.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 self-start sm:self-center">
                    <div className="flex items-center gap-2">
                       <Label htmlFor={`switch-${w.id}`} className="sr-only">Toggle webhook</Label>
                       <Switch
                         id={`switch-${w.id}`}
                         checked={w.active}
                         onCheckedChange={(v) => toggle(w.id, v)}
                         className="data-[state=checked]:bg-success"
                       />
                    </div>
                    <Button
                       variant="outline"
                       size="sm"
                       onClick={() => remove(w.id)}
                       className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:mr-2" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New webhook endpoint</DialogTitle>
            <DialogDescription>
              We'll POST a JSON payload to this URL whenever a subscribed event fires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.mysite.com/otpwave/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-muted/30 focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-3">
              <Label>Events to send</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EVENT_OPTIONS.map((event) => {
                  const checked = events.includes(event);
                  return (
                    <label
                      key={event}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border ${checked ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-card/40'} px-4 py-3 text-sm transition-colors hover:bg-muted/30`}
                    >
                      <span className={checked ? "font-medium text-primary" : "text-foreground/80"}>{event}</span>
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
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={busy} className="shadow-sm">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Save your signing secret</DialogTitle>
            <DialogDescription className="text-base text-warning">
              Use this secret to verify the HMAC signature of incoming webhook deliveries. We won't show it again.
            </DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="space-y-4 py-4">
              <div className="text-sm font-semibold break-all">{revealed.url}</div>
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-inner">
                <span className="flex-1 font-mono text-sm break-all text-primary">{revealed.secret}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 shadow-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(revealed.secret);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)} className="w-full sm:w-auto shadow-sm">I've saved it securely</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
