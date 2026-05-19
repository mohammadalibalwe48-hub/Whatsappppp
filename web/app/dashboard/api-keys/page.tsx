"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; secret: string } | null>(null);

  async function load() {
    try {
      const res = await apiFetch<{ ok: true; apiKeys: ApiKey[] }>("/dashboard/api-keys");
      setKeys(res.apiKeys);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load API keys");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    if (!name.trim()) {
      toast.error("Give your key a name first");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: true; apiKey: ApiKey; secret: string }>("/dashboard/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() })
      });
      setOpen(false);
      setName("");
      setRevealed({ name: res.apiKey.name, secret: res.secret });
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? Any client using it will stop working immediately.")) return;
    try {
      await apiFetch(`/dashboard/api-keys/${id}`, { method: "DELETE" });
      toast.success("API key revoked");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to revoke key");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="text-sm text-muted-foreground">
            Use these keys to authenticate your server with the OtpWave API.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Active keys
          </CardTitle>
          <CardDescription>
            We only store hashes of your keys. The full secret is shown once — store it safely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keys === null ? (
            <Skeleton className="h-32 w-full" />
          ) : keys.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No API keys yet. Create one to start integrating.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{k.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {k.prefix}…
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Created {formatRelative(k.created_at)} · Last used{" "}
                      {k.last_used_at ? formatRelative(k.last_used_at) : "never"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {k.revoked_at ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                    {!k.revoked_at && (
                      <Button variant="ghost" size="icon" onClick={() => revoke(k.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give your key a memorable name — for example, "Production web".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Production web"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createKey} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your new key</DialogTitle>
            <DialogDescription>
              This is the only time we'll show the full secret. Copy and store it securely.
            </DialogDescription>
          </DialogHeader>
          {revealed ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">{revealed.name}</div>
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
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>I&apos;ve saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
