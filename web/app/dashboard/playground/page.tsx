"use client";

import { useState } from "react";
import { CheckCircle2, Play, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface SendResp {
  ok: true;
  otpId: string;
  expiresAt: string;
  ttlSeconds: number;
  apiKey: { id: string; name: string; prefix: string };
}

interface VerifyResp {
  ok: true;
  status: string;
  otpId?: string;
  phoneNumber?: string;
  attemptsRemaining?: number;
  reason?: string;
  retryAfter?: number;
}

export default function PlaygroundPage() {
  const [phone, setPhone] = useState("");
  const [appName, setAppName] = useState("My App");
  const [length, setLength] = useState(6);
  const [alphabet, setAlphabet] = useState<"numeric" | "alphanumeric" | "alphabetic">(
    "numeric"
  );
  const [ttl, setTtl] = useState(300);

  const [sendResult, setSendResult] = useState<SendResp | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResp | null>(null);
  const [code, setCode] = useState("");

  const [sendingNow, setSendingNow] = useState(false);
  const [verifyingNow, setVerifyingNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSendingNow(true);
    setError(null);
    setVerifyResult(null);
    try {
      const res = await apiFetch<SendResp>("/dashboard/playground/send", {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: phone,
          appName: appName || undefined,
          length,
          alphabet,
          ttlSeconds: ttl
        })
      });
      setSendResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingNow(false);
    }
  }

  async function verify() {
    if (!sendResult) return;
    setVerifyingNow(true);
    setError(null);
    try {
      const res = await apiFetch<VerifyResp>("/dashboard/playground/verify", {
        method: "POST",
        body: JSON.stringify({ otpId: sendResult.otpId, code })
      });
      setVerifyResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyingNow(false);
    }
  }

  function reset() {
    setSendResult(null);
    setVerifyResult(null);
    setCode("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
          <p className="text-sm text-muted-foreground">
            Send a real OTP to test your setup end-to-end. Uses your most recently
            created API key automatically.
          </p>
        </div>
        {sendResult ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" /> 1. Send OTP
            </CardTitle>
            <CardDescription>
              We&apos;ll generate a code and message it to this phone via your paired
              WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number (E.164)</Label>
              <Input
                id="phone"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!!sendResult}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appName">App name (shown in message)</Label>
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                disabled={!!sendResult}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="length">Code length</Label>
                <Input
                  id="length"
                  type="number"
                  min={4}
                  max={10}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  disabled={!!sendResult}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alphabet">Alphabet</Label>
                <select
                  id="alphabet"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={alphabet}
                  onChange={(e) => setAlphabet(e.target.value as typeof alphabet)}
                  disabled={!!sendResult}
                >
                  <option value="numeric">numeric</option>
                  <option value="alphanumeric">alphanumeric</option>
                  <option value="alphabetic">alphabetic</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ttl">TTL (s)</Label>
                <Input
                  id="ttl"
                  type="number"
                  min={30}
                  max={3600}
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                  disabled={!!sendResult}
                />
              </div>
            </div>
            <Button
              onClick={send}
              disabled={!phone || sendingNow || !!sendResult}
              className="w-full"
            >
              <Play className="mr-1 h-4 w-4" />
              {sendingNow ? "Sending…" : "Send OTP"}
            </Button>
            {sendResult ? (
              <div className="rounded-md border border-green-500/40 bg-green-500/5 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-green-500">
                  <CheckCircle2 className="h-4 w-4" /> Sent
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">otpId</span>
                  <code className="truncate font-mono">{sendResult.otpId}</code>
                  <span className="text-muted-foreground">expires</span>
                  <span>{new Date(sendResult.expiresAt).toLocaleTimeString()}</span>
                  <span className="text-muted-foreground">key used</span>
                  <span className="font-mono">
                    {sendResult.apiKey.name} ({sendResult.apiKey.prefix}…)
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> 2. Verify code
            </CardTitle>
            <CardDescription>
              Type the code that arrived on the phone to confirm verification works.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code received</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                disabled={!sendResult || !!verifyResult}
                placeholder="123456"
              />
            </div>
            <Button
              onClick={verify}
              disabled={!sendResult || !code || verifyingNow || !!verifyResult}
              className="w-full"
            >
              {verifyingNow ? "Verifying…" : "Verify"}
            </Button>

            {verifyResult ? (
              <div
                className={`rounded-md border p-3 text-sm ${
                  verifyResult.status === "verified"
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {verifyResult.status === "verified" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <Badge
                    variant={verifyResult.status === "verified" ? "secondary" : "destructive"}
                  >
                    {verifyResult.status}
                  </Badge>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Use this in your code</CardTitle>
          <CardDescription>
            Same request, made from your server using one of your API keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 font-mono text-xs leading-relaxed">
{`curl https://otpwave-api.fly.dev/v1/otp/send \\
  -H "X-API-Key: $OTPWAVE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumber": "${phone || "+15551234567"}",
    "appName": "${appName}",
    "length": ${length},
    "alphabet": "${alphabet}",
    "ttlSeconds": ${ttl}
  }'`}
          </pre>
          <div className="mt-3 text-xs text-muted-foreground">
            Need an API key?{" "}
            <Link href="/dashboard/api-keys" className="underline">
              Manage API keys
            </Link>
            .
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
