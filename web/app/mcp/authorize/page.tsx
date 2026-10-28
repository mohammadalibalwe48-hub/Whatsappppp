"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bot, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, apiUrl } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ClientInfo {
  clientName: string;
  callbackHost: string;
}

interface AuthorizationResult {
  redirectUrl: string;
}

function AuthorizationForm() {
  const router = useRouter();
  const search = useSearchParams();
  const query = useMemo(() => search.toString(), [search]);
  const accountScopeRequested = useMemo(() => {
    const scopes = new URLSearchParams(query).get("scope")?.split(/\s+/) ?? [];
    return scopes.includes("account:manage");
  }, [query]);
  const [clientName, setClientName] = useState("MCP client");
  const [callbackHost, setCallbackHost] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const authorizeQuery = new URLSearchParams(query);
    const clientId = authorizeQuery.get("client_id");
    const redirectUri = authorizeQuery.get("redirect_uri");

    if (!clientId || !redirectUri || !authorizeQuery.get("state")) {
      setError("This authorization link is incomplete. Start the connection again from your AI app.");
      setLoading(false);
      return;
    }

    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        const returnTo = `/mcp/authorize?${query}`;
        router.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/oauth/clients/${encodeURIComponent(clientId!)}?redirect_uri=${encodeURIComponent(redirectUri!)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error_description ?? "Could not identify the AI app.");
        if (active) {
          setClientName((result as ClientInfo).clientName);
          setCallbackHost((result as ClientInfo).callbackHost);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load the authorization details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [query, router]);

  async function approve() {
    setAuthorizing(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      const body = {
        client_id: params.get("client_id"),
        redirect_uri: params.get("redirect_uri"),
        response_type: params.get("response_type") ?? "code",
        state: params.get("state"),
        code_challenge: params.get("code_challenge"),
        code_challenge_method: params.get("code_challenge_method") ?? "S256",
        scope: params.get("scope"),
        resource: params.get("resource")
      };
      const result = await apiFetch<AuthorizationResult>("/oauth/authorize/complete", {
        method: "POST",
        body: JSON.stringify(body)
      });
      window.location.assign(result.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve this connection.");
      setAuthorizing(false);
    }
  }

  return (
    <Card className="w-full max-w-lg border-border/50 shadow-2xl shadow-black/10">
      <CardHeader className="items-center text-center pb-4">
        <div className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Bot className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl">Connect an AI app</CardTitle>
        <CardDescription className="max-w-sm text-base">
          <span className="font-medium text-foreground">{clientName}</span> is requesting access to your OtpWave account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            This app can
          </div>
          <ul className="space-y-2 pl-6 text-sm text-muted-foreground list-disc">
            <li>Send, verify, and resend OTPs; check their status.</li>
            {accountScopeRequested && <>
              <li>Read OTP logs and analytics.</li>
              <li>Connect, disconnect, or remove your WhatsApp pairing. Pairing can show a QR image to this AI app so you can scan it with your phone.</li>
              <li>View, create, edit, and revoke API keys. A newly created secret is shown once in the AI conversation.</li>
              <li>View and manage webhooks. A new webhook signing secret is shown once in the AI conversation.</li>
              <li>Read and update your display name, and change your password. If you ask to change it, the new password is sent through this AI app.</li>
              <li>Permanently delete your account only after you explicitly confirm the deletion.</li>
            </>}
          </ul>
        </div>
        {!accountScopeRequested && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            This AI app requested OTP access only. It can use OTP tools now; OtpWave will request account permission before it can manage WhatsApp, keys, webhooks, or profile settings.
          </p>
        )}
        {callbackHost && (
          <p className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">
            OAuth callback domain: <span className="font-medium text-foreground">{callbackHost}</span>. Check that it belongs to the AI app you are connecting.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" onClick={approve} disabled={loading || authorizing || !!error}>
            {authorizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            {authorizing ? "Connecting…" : "Allow access"}
          </Button>
          <Button variant="outline" asChild disabled={authorizing}>
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>
        {loading && <p className="text-center text-xs text-muted-foreground">Checking your OtpWave session…</p>}
        <p className="text-center text-xs text-muted-foreground">
          You can revoke this connection any time by revoking its MCP key from your API Keys page.
        </p>
      </CardContent>
    </Card>
  );
}

export default function McpAuthorizationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-8 flex justify-center text-xl font-bold tracking-tight">OtpWave</Link>
        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <AuthorizationForm />
        </Suspense>
      </div>
    </main>
  );
}
