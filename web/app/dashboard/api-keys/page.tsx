"use client";

import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Copy, KeyRound, Loader2, Plus, Trash2, Pencil } from "lucide-react";
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

type OtpAlphabet = "numeric" | "alphanumeric" | "alpha";

const ALPHABET_LABELS: Record<OtpAlphabet, string> = {
  numeric: "1234567890",
  alphanumeric: "A-Z, 0-9",
  alpha: "A-Z"
};
const ALPHABET_OPTIONS: OtpAlphabet[] = ["numeric", "alphanumeric", "alpha"];

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  default_otp_length: number;
  default_otp_alphabet: OtpAlphabet;
  default_message_template: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);

  // create state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [createLength, setCreateLength] = useState(6);
  const [createAlphabet, setCreateAlphabet] = useState<OtpAlphabet>("numeric");
  const [createTemplate, setCreateTemplate] = useState("");

  // edit state
  const [editing, setEditing] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editLength, setEditLength] = useState(6);
  const [editAlphabet, setEditAlphabet] = useState<OtpAlphabet>("numeric");
  const [editTemplate, setEditTemplate] = useState("");

  // global loading block
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; secret: string } | null>(null);

  async function load() {
    try {
      const { keys } = await apiFetch<{ ok: true; keys: ApiKey[] }>("/dashboard/api-keys");
      setKeys(keys);
    } catch {
      // toast in api.ts
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createKey() {
    if (!name) return toast.error("Name is required");
    setBusy(true);
    try {
      const { secret } = await apiFetch<{ ok: true; secret: string }>("/dashboard/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name,
          default_otp_length: createLength,
          default_otp_alphabet: createAlphabet,
          default_message_template: createTemplate || null
        })
      });
      setRevealed({ name, secret });
      setCreateOpen(false);
      setName("");
      setCreateLength(6);
      setCreateAlphabet("numeric");
      setCreateTemplate("");
      load();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(key: ApiKey) {
    setEditName(key.name);
    setEditLength(key.default_otp_length);
    setEditAlphabet(key.default_otp_alphabet);
    setEditTemplate(key.default_message_template || "");
    setEditing(key);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName) return toast.error("Name is required");
    setBusy(true);
    try {
      await apiFetch(`/dashboard/api-keys/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          default_otp_length: editLength,
          default_otp_alphabet: editAlphabet,
          default_message_template: editTemplate || null
        })
      });
      toast.success("Saved");
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? It will instantly stop working.")) return;
    try {
      await apiFetch(`/dashboard/api-keys/${id}`, { method: "DELETE" });
      load();
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">API keys</h1>
        <p className="text-base text-muted-foreground mt-1">Manage the keys used to authenticate your application.</p>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between border-b border-border/10 pb-6 mb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
               <KeyRound className="h-5 w-5 text-primary" /> Active keys
            </CardTitle>
            <CardDescription className="mt-1">
              Do not expose your keys to the browser. Only call OtpWave from your backend.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Create new key
          </Button>
        </CardHeader>
        <CardContent>
          {keys === null ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">No API keys yet. Create one to start integrating.</p>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                Create your first key
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40 -mx-6">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 group hover:bg-muted/10 transition-colors">
                  <div className="space-y-2 mb-4 sm:mb-0">
                    <div className="flex items-center gap-2">
                       <div className="font-semibold text-foreground/90 text-lg">{k.name}</div>
                       {k.revoked_at ? (
                         <Badge variant="destructive" className="h-5">Revoked</Badge>
                       ) : (
                         <Badge variant="success" className="h-5 shadow-sm">Active</Badge>
                       )}
                    </div>
                    <div className="font-mono text-sm text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md inline-block border border-border/40">
                      {k.prefix}••••••••••••
                    </div>
                    <div className="text-sm text-muted-foreground/80 flex items-center gap-2">
                      <span>Created {formatRelative(k.created_at)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">
                         Last used {k.last_used_at ? formatRelative(k.last_used_at) : "never"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-border/40 shadow-sm">
                        Length {k.default_otp_length}
                      </Badge>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground border-border/40 shadow-sm">
                        {ALPHABET_LABELS[k.default_otp_alphabet]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {!k.revoked_at && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(k)}
                          aria-label="Edit key defaults"
                          className="h-8 shadow-sm"
                        >
                          <Pencil className="h-3.5 w-3.5 sm:mr-2" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revoke(k.id)}
                          aria-label="Revoke key"
                          className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:mr-2" />
                          <span className="hidden sm:inline">Revoke</span>
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              These OTP defaults are used whenever a `/v1/otp/send` request omits them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production web"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted/30 focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-template">Message Template (Optional)</Label>
              <Input
                id="create-template"
                placeholder="Your {{appName}} code is {{code}}."
                value={createTemplate}
                onChange={(e) => setCreateTemplate(e.target.value)}
                className="bg-muted/30 focus-visible:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground/80">Vars: {'{{'}code{'}}'}, {'{{'}appName{'}}'}, {'{{'}ttlMinutes{'}}'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-length">Length</Label>
                <Input
                  id="create-length"
                  type="number"
                  min={4}
                  max={10}
                  value={createLength}
                  onChange={(e) =>
                    setCreateLength(Math.max(4, Math.min(10, Number(e.target.value) || 6)))
                  }
                  className="bg-muted/30 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-alphabet">Format</Label>
                <select
                  id="create-alphabet"
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
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
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createKey} disabled={busy} className="shadow-sm">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit API key</DialogTitle>
            <DialogDescription>
              Update defaults. The secret itself can't be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-muted/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template">Message Template</Label>
              <Input
                id="edit-template"
                placeholder="Your {{appName}} code is {{code}}."
                value={editTemplate}
                onChange={(e) => setEditTemplate(e.target.value)}
                className="bg-muted/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-length">Length</Label>
                <Input
                  id="edit-length"
                  type="number"
                  min={4}
                  max={10}
                  value={editLength}
                  onChange={(e) =>
                    setEditLength(Math.max(4, Math.min(10, Number(e.target.value) || 6)))
                  }
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-alphabet">Format</Label>
                <select
                  id="edit-alphabet"
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
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
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={busy} className="shadow-sm">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal-secret dialog */}
      <Dialog open={!!revealed} onOpenChange={() => setRevealed(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Save your new API key</DialogTitle>
            <DialogDescription className="text-base text-warning">
              This is the only time we'll show the full secret. Copy and store it securely.
            </DialogDescription>
          </DialogHeader>
          {revealed ? (
            <div className="space-y-4 py-4">
              <div className="text-sm font-semibold">{revealed.name}</div>
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
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRevealed(null)} className="w-full sm:w-auto shadow-sm">I've saved it securely</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
