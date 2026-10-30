"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Check, CircleAlert, Clock3, LoaderCircle, MessageSquare, RefreshCw, Save, ShieldCheck, Sparkles, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Provider = "gemini" | "groq" | "openai_compatible";
interface AssistantSettings {
  provider: Provider;
  model: string;
  baseUrl: string;
  systemPrompt: string;
  enabled: boolean;
  maxRepliesPerDay: number;
  keyConfigured: boolean;
}
interface ReplyEvent {
  account_jid: string;
  chat_jid: string;
  source_message_id: string;
  reply_message_id: string | null;
  status: "processing" | "sent" | "skipped" | "failed";
  reason: string | null;
  created_at: string;
}
interface AiModel { id: string; name: string }

const PROVIDER_DEFAULTS: Record<Provider, { label: string; model: string; baseUrl: string }> = {
  gemini: { label: "Google Gemini", model: "gemini-2.5-flash", baseUrl: "" },
  groq: { label: "Groq", model: "llama-3.3-70b-versatile", baseUrl: "https://api.groq.com/openai/v1" },
  openai_compatible: { label: "OpenAI-compatible", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" }
};

const emptySettings: AssistantSettings = {
  provider: "gemini", model: PROVIDER_DEFAULTS.gemini.model, baseUrl: "", systemPrompt: "",
  enabled: false, maxRepliesPerDay: 100, keyConfigured: false
};

export default function AssistantPage() {
  const [settings, setSettings] = useState<AssistantSettings>(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [events, setEvents] = useState<ReplyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [models, setModels] = useState<AiModel[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);

  const providerName = useMemo(() => PROVIDER_DEFAULTS[settings.provider].label, [settings.provider]);

  async function load() {
    try {
      const [savedResult, activityResult] = await Promise.allSettled([
        apiFetch<{ settings: AssistantSettings }>("/dashboard/ai/settings"),
        apiFetch<{ events: ReplyEvent[] }>("/dashboard/ai/activity")
      ]);
      if (savedResult.status === "rejected") throw savedResult.reason;
      setSettings(savedResult.value.settings);
      setEvents(activityResult.status === "fulfilled" ? activityResult.value.events : []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not reach the OtpWave API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const refreshModels = useCallback(async (keyOverride?: string) => {
    const key = keyOverride ?? apiKey.trim();
    if (!key && !settings.keyConfigured) {
      setModels([]);
      setModelsError("Enter your provider API key to load its model list.");
      return;
    }
    setLoadingModels(true);
    setModelsError("");
    try {
      const result = await apiFetch<{ models: AiModel[] }>("/dashboard/ai/models", {
        method: "POST",
        body: JSON.stringify({
          provider: settings.provider,
          baseUrl: settings.provider === "openai_compatible" ? settings.baseUrl : undefined,
          apiKey: key || undefined
        })
      });
      setModels(result.models);
      if (!result.models.length) setModelsError("The provider returned no available models for this key.");
    } catch (error) {
      setModels([]);
      setModelsError(error instanceof Error ? error.message : "Could not load models from this provider.");
    } finally {
      setLoadingModels(false);
    }
  }, [apiKey, settings.baseUrl, settings.keyConfigured, settings.provider]);

  useEffect(() => {
    const key = apiKey.trim();
    if ((!settings.keyConfigured || clearKey) && key.length < 16) {
      setModels([]);
      setModelsError("");
      return;
    }
    const timer = window.setTimeout(() => { void refreshModels(key); }, key ? 700 : 0);
    return () => window.clearTimeout(timer);
  }, [apiKey, clearKey, refreshModels, settings.keyConfigured]);

  function chooseProvider(provider: Provider) {
    const defaults = PROVIDER_DEFAULTS[provider];
    setSettings((current) => ({ ...current, provider, model: defaults.model, baseUrl: defaults.baseUrl }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await apiFetch<{ settings: AssistantSettings }>("/dashboard/ai/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: settings.provider,
          model: settings.model,
          baseUrl: settings.provider === "openai_compatible" ? settings.baseUrl : undefined,
          systemPrompt: settings.systemPrompt,
          enabled: settings.enabled,
          maxRepliesPerDay: Number(settings.maxRepliesPerDay),
          apiKey: apiKey.trim() || undefined,
          clearApiKey: clearKey
        })
      });
      setSettings(result.settings);
      setApiKey("");
      setClearKey(false);
      toast.success("AI assistant settings saved");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      await apiFetch("/dashboard/ai/test", {
        method: "POST",
        body: JSON.stringify({
          provider: settings.provider,
          model: settings.model,
          baseUrl: settings.provider === "openai_compatible" ? settings.baseUrl : undefined,
          systemPrompt: settings.systemPrompt,
          maxRepliesPerDay: Number(settings.maxRepliesPerDay),
          apiKey: apiKey.trim() || undefined
        })
      });
      toast.success("Provider connection works");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setTesting(false);
    }
  }

  const update = <K extends keyof AssistantSettings>(key: K, value: AssistantSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  if (loading) return <div role="status" className="grid min-h-64 place-items-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading AI assistant…</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Workspace automation</p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-.04em] sm:text-4xl">AI assistant</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Connect a model with your own API key, then choose whether it can answer new WhatsApp messages.</p>
        </div>
        <Badge variant={settings.enabled ? "success" : "secondary"} className="w-fit gap-1.5 px-3 py-1.5"><span className={`h-1.5 w-1.5 rounded-full ${settings.enabled ? "bg-success" : "bg-muted-foreground"}`} />{settings.enabled ? "Automatic replies on" : "Paused"}</Badge>
      </header>

      {loadError && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">Couldn’t load assistant settings: {loadError}</span><Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }}>Retry</Button></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" /> Provider and behavior</CardTitle>
            <CardDescription>Your API key is encrypted on the server and never shown back here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-5 sm:pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="ai-provider">Provider</Label><select id="ai-provider" value={settings.provider} onChange={(event) => chooseProvider(event.target.value as Provider)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="openai_compatible">OpenAI-compatible provider</option></select></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2"><Label htmlFor="ai-model">Model</Label><Button type="button" variant="ghost" size="sm" onClick={() => void refreshModels()} disabled={loadingModels || (clearKey && !apiKey.trim())} className="h-8 px-2 text-xs"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} />{loadingModels ? "Loading" : "Refresh models"}</Button></div>
                {models.length > 0 ? <select id="ai-model" value={settings.model} onChange={(event) => update("model", event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  {!models.some((model) => model.id === settings.model) && <option value={settings.model}>{settings.model} (saved model)</option>}
                  {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select> : <Input id="ai-model" value={settings.model} onChange={(event) => update("model", event.target.value)} placeholder={PROVIDER_DEFAULTS[settings.provider].model} maxLength={120} />}
                <p aria-live="polite" className={`text-xs leading-5 ${modelsError && !modelsError.startsWith("Enter your") ? "text-destructive" : "text-muted-foreground"}`}>{loadingModels ? `Loading available ${providerName} models…` : modelsError || (models.length ? `${models.length} models available for this API key.` : "Models load automatically after you enter a provider key.")}</p>
              </div>
            </div>

            {settings.provider === "openai_compatible" && <div className="space-y-2"><Label htmlFor="ai-base-url">Provider base URL</Label><Input id="ai-base-url" type="url" value={settings.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} placeholder="https://api.openai.com/v1" autoCapitalize="none" autoCorrect="off" /><p className="text-xs leading-5 text-muted-foreground">Supported endpoints include OpenAI, OpenRouter, DeepSeek, Together, Fireworks, Mistral, Cerebras, Perplexity, and xAI.</p></div>}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="ai-api-key">Provider API key</Label>{settings.keyConfigured && !clearKey && <Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Key saved</Badge>}</div>
              <Input id="ai-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.keyConfigured && !clearKey ? "Saved securely · enter a new key to replace" : "Paste your provider API key"} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Sent only to the OtpWave API and your selected model provider.</span>{settings.keyConfigured && <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => { setClearKey((current) => !current); setApiKey(""); }}>{clearKey ? "Keep saved key" : "Remove saved key"}</button>}</div>
            </div>

            <div className="space-y-2"><Label htmlFor="ai-prompt">Reply instructions</Label><textarea id="ai-prompt" value={settings.systemPrompt} onChange={(event) => update("systemPrompt", event.target.value)} placeholder="Example: We are a small bakery in Amman. Our hours are 9 AM–6 PM. Keep replies warm and concise." maxLength={2000} rows={5} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-6 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-right text-xs text-muted-foreground">{settings.systemPrompt.length}/2000</p></div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary"><Sparkles className="h-4 w-4" /></span><div><Label htmlFor="ai-enabled" className="text-sm font-semibold">Enable automatic replies</Label><p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">When on, the assistant responds to new incoming direct text messages from your connected WhatsApp account.</p></div></div>
              <Switch id="ai-enabled" checked={settings.enabled} onCheckedChange={(value) => update("enabled", value)} aria-label="Enable automatic replies" className="h-6 w-11 self-start sm:self-center" />
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2"><Label htmlFor="ai-daily-limit">Daily reply limit</Label><Input id="ai-daily-limit" type="number" inputMode="numeric" min={1} max={500} value={settings.maxRepliesPerDay} onChange={(event) => update("maxRepliesPerDay", Number(event.target.value))} /><p className="text-xs text-muted-foreground">1–500 responses per UTC day. The default is 100.</p></div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={testConnection} disabled={testing || saving} className="h-11"><TestTube2 className="mr-2 h-4 w-4" />{testing ? "Testing…" : "Test provider"}</Button><Button type="button" onClick={save} disabled={saving || testing || Boolean(loadError)} className="h-11">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</Button></div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">What it will do</CardTitle><CardDescription>Automatic replies are deliberately narrow and easy to stop.</CardDescription></CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <Rule icon={<Check className="h-4 w-4" />} text="Answers new one-to-one text messages only" />
              <Rule icon={<MessageSquare className="h-4 w-4" />} text="Replies in the same chat, quoting the incoming message" />
              <Rule icon={<CircleAlert className="h-4 w-4" />} text="Ignores groups, media, history sync, and its own replies" />
              <Rule icon={<ShieldCheck className="h-4 w-4" />} text="Won’t ask for or reveal verification codes, passwords, or payment details" />
              <Rule icon={<Clock3 className="h-4 w-4" />} text="Stops at your daily response limit" />
              <div className="rounded-lg border border-primary/20 bg-primary/[.045] p-3 text-xs leading-5 text-muted-foreground">Model providers may charge for API use. Their service receives the new message and up to 11 recent text messages from that conversation to provide context.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Recent AI replies</CardTitle><CardDescription className="mt-1">Latest automatic reply attempts.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh AI reply activity"><Clock3 className="h-4 w-4" /></Button></CardHeader>
            <CardContent className="space-y-1 pt-0">
              {events.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No automatic replies yet.</p> : events.slice(0, 8).map((event) => <ActivityRow key={`${event.account_jid}:${event.source_message_id}`} event={event} />)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-start gap-2.5 text-muted-foreground"><span className="mt-0.5 shrink-0 text-primary">{icon}</span><span className="leading-5">{text}</span></div>;
}

function ActivityRow({ event }: { event: ReplyEvent }) {
  const recipient = event.chat_jid.endsWith("@lid") ? "WhatsApp contact" : event.chat_jid.split("@")[0];
  const label = event.status === "sent" ? "Sent" : event.status === "failed" ? "Failed" : event.status === "skipped" ? "Skipped" : "Working";
  const variant = event.status === "sent" ? "success" : event.status === "failed" ? "destructive" : event.status === "skipped" ? "secondary" : "outline";
  const reason = event.reason === "daily_limit" ? "Daily limit reached" : event.reason === "provider_error" ? "Provider request failed" : event.reason === "send_error" ? "WhatsApp send failed" : event.reason === "empty_reply" ? "No reply from model" : null;
  return <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-sm font-medium">{recipient}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}{reason ? ` · ${reason}` : ""}</p></div><Badge variant={variant}>{label}</Badge></div>;
}
