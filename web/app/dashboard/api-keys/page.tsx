"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

type OtpAlphabet = "numeric" | "alphanumeric" | "alphabetic";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  default_otp_length: number;
  default_otp_alphabet: OtpAlphabet;
}

const ALPHABET_LABELS: Record<OtpAlphabet, string> = {
  numeric: "Numeric (0-9)",
  alphanumeric: "Alphanumeric (A-Z + 2-9)",
  alphabetic: "Alphabetic (A-Z)"
};

const ALPHABET_OPTIONS: OtpAlphabet[] = ["numeric", "alphanumeric", "alphabetic"];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; secret: string } | null>(null);

  // Create-form state.
  const [name, setName] = useState("");
  const [createLength, setCreateLength] = useState(6);
  const [createAlphabet, setCreateAlphabet] = useState<OtpAlphabet>("numeric");

  // Edit-form state.
  const [editName, setEditName] = useState("");
  const [editLength, setEditLength] = useState(6);
  const [editAlphabet, setEditAlphabet] = useState<OtpAlphabet>("numeric");

  async function load() {
    try {
      const res = await apiFetch<{ ok: true; apiKeys: ApiKey[] }>("/dashboard/api-keys");
      setKeys(res.apiKeys);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load API keys");
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openEdit(k: ApiKey) {
    setEditing(k);
    setEditName(k.name);
    setEditLength(k.default_otp_length);
    setEditAlphabet(k.default_otp_alphabet);
  }

  async function createKey() {
    if (!name.trim()) {
      toast.error("Give your key a name first");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: true; apiKey: ApiKey; secret: string }>(
        "/dashboard/api-keys",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            defaultOtpLength: createLength,
            defaultOtpAlphabet: createAlphabet
          })
        }
      );
      setCreateOpen(false);
      setName("");
      setCreateLength(6);
      setCreateAlphabet("numeric");
      setRevealed({ name: res.apiKey.name, secret: res.secret });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/dashboard/api-keys/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          defaultOtpLength: editLength,
          defaultOtpAlphabet: editAlphabet
        })
      });
      toast.success("Updated");
      setEditing(null);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update key");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
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
        <Button onClick={() => setCreateOpen(true)}>
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
                    <div className="font-mono text-xs text-muted-foreground">{k.prefix}…</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Created {formatRelative(k.created_at)} · Last used{" "}
                      {k.last_used_at ? formatRelative(k.last_used_at) : "never"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        Length {k.default_otp_length}
                      </Badge>
                      <Badge variant="secondary">{ALPHABET_LABELS[k.default_otp_alphabet]}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {k.revoked_at ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                    {!k.revoked_at && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(k)}
                          aria-label="Edit key defaults"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revoke(k.id)}
                          aria-label="Revoke key"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              These OTP defaults are used whenever a `/v1/otp/send` request omits them. You can
              still override per-request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production web"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-length">OTP length</Label>
                <Input
                  id="create-length"
                  type="number"
                  min={4}
                  max={10}
                  value={createLength}
                  onChange={(e) =>
                    setCreateLength(Math.max(4, Math.min(10, Number(e.target.value) || 6)))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-alphabet">Character set</Label>
                <select
                  id="create-alphabet"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={createAlphabet}
                  onChange={(e) => setCreateAlphabet(e.target.value as OtpAlphabet)}
                >
                  {ALPHABET_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {ALPHABET_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createKey} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API key</DialogTitle>
            <DialogDescription>
              Update the name and OTP defaults. The secret itself can&apos;t be changed — revoke
              and create a new key if you need to rotate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-length">OTP length</Label>
                <Input
                  id="edit-length"
                  type="number"
                  min={4}
                  max={10}
                  value={editLength}
                  onChange={(e) =>
                    setEditLength(Math.max(4, Math.min(10, Number(e.target.value) || 6)))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-alphabet">Character set</Label>
                <select
                  id="edit-alphabet"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editAlphabet}
                  onChange={(e) => setEditAlphabet(e.target.value as OtpAlphabet)}
                >
                  {ALPHABET_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {ALPHABET_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-secret dialog (unchanged) */}
      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your new key</DialogTitle>
            <DialogDescription>
              This is the only time we&apos;ll show the full secret. Copy and store it securely.
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
