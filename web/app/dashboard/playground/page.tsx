"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Play, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

interface SendResp {
  ok: true;
  otpId: string;
  expiresAt: string;
  apiKey: { id: string; name: string; prefix: string };
}
interface VerifyResp {
  ok: true;
  status: "verified" | "invalid" | "expired" | "not_found";
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Playground</h1>
          <p className="text-base text-muted-foreground mt-1">
            Send a real OTP to test your setup end-to-end. Uses your most recently
            created API key automatically.
          </p>
        </div>
        {sendResult ? (
          <Button variant="outline" size="sm" onClick={reset} className="shadow-sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Reset Flow
          </Button>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive font-medium">
            <XCircle className="h-5 w-5" /> {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={`shadow-lg border-border/50 transition-colors duration-300 ${!sendResult ? 'border-primary/30 shadow-primary/5 bg-card' : 'bg-muted/10 opacity-80'}`}>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 text-xl ${!sendResult ? 'text-primary' : 'text-foreground/70'}`}>
              <Send className="h-5 w-5" /> 1. Send OTP
            </CardTitle>
            <CardDescription className="text-base">
              We'll generate a code and message it to this phone via your paired WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number (E.164)</Label>
              <Input
                id="phone"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!!sendResult}
                className="bg-background focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appName">App name (shown in message)</Label>
              <Input
                id="appName"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                disabled={!!sendResult}
                className="bg-background focus-visible:ring-primary/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">Length</Label>
                <Input
                  id="length"
                  type="number"
                  min={4}
                  max={10}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  disabled={!!sendResult}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alphabet">Alphabet</Label>
                <select
                  id="alphabet"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
                  value={alphabet}
                  onChange={(e) => setAlphabet(e.target.value as typeof alphabet)}
                  disabled={!!sendResult}
                >
                  <option value="numeric">numeric</option>
                  <option value="alphanumeric">alphanumeric</option>
                  <option value="alphabetic">alphabetic</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttl">TTL (s)</Label>
                <Input
                  id="ttl"
                  type="number"
                  min={30}
                  max={3600}
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                  disabled={!!sendResult}
                  className="bg-background"
                />
              </div>
            </div>
            <Button
              onClick={send}
              disabled={!phone || sendingNow || !!sendResult}
              className="w-full shadow-md"
            >
              <Play className="mr-2 h-4 w-4" />
              {sendingNow ? "Sending…" : "Send OTP"}
            </Button>
            {sendResult ? (
              <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm animate-fade-in mt-4 shadow-inner">
                <div className="flex items-center gap-2 font-semibold text-success mb-3 text-base">
                  <CheckCircle2 className="h-5 w-5" /> OTP Sent Successfully
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-muted-foreground">otpId:</span>
                  <code className="truncate font-mono text-foreground">{sendResult.otpId}</code>
                  <span className="text-muted-foreground">expires:</span>
                  <span className="font-medium text-foreground">{new Date(sendResult.expiresAt).toLocaleTimeString()}</span>
                  <span className="text-muted-foreground">key used:</span>
                  <span className="font-mono text-foreground truncate">
                    {sendResult.apiKey.name} ({sendResult.apiKey.prefix}…)
                  </span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={`shadow-lg border-border/50 transition-colors duration-300 ${sendResult && !verifyResult ? 'border-primary/30 shadow-primary/5 bg-card' : 'bg-muted/10 opacity-90'}`}>
          <CardHeader className="pb-4">
            <CardTitle className={`flex items-center gap-2 text-xl ${sendResult && !verifyResult ? 'text-primary' : 'text-foreground/70'}`}>
              <ShieldCheck className="h-5 w-5" /> 2. Verify code
            </CardTitle>
            <CardDescription className="text-base">
              Type the code that arrived on the phone to confirm verification works.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code">Code received</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                disabled={!sendResult || !!verifyResult}
                placeholder="123456"
                className="bg-background text-lg font-mono tracking-widest h-12 px-4 focus-visible:ring-primary/40"
              />
            </div>
            <Button
              onClick={verify}
              disabled={!sendResult || !code || verifyingNow || !!verifyResult}
              className="w-full shadow-md h-11 text-base"
            >
              {verifyingNow ? "Verifying…" : "Verify Code"}
            </Button>

            {verifyResult ? (
              <div
                className={`rounded-xl border p-5 text-sm animate-fade-in shadow-inner ${
                  verifyResult.status === "verified"
                    ? "border-success/40 bg-success/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-semibold mb-4 text-base">
                  <div className="flex items-center gap-2">
                    {verifyResult.status === "verified" ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className={verifyResult.status === "verified" ? "text-success" : "text-destructive"}>
                       Verification Result
                    </span>
                  </div>
                  <Badge
                    variant={verifyResult.status === "verified" ? "success" : "destructive"}
                    className="shadow-sm uppercase tracking-wider"
                  >
                    {verifyResult.status}
                  </Badge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-black/80 text-green-400 p-4 font-mono text-xs border border-white/10">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Use this in your code</CardTitle>
          <CardDescription className="text-base mt-1">
            Same request, made from your server using one of your API keys.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative group">
            <pre className="overflow-x-auto rounded-xl border border-border/40 bg-[#0d1117] p-5 font-mono text-sm leading-relaxed shadow-inner">
              <code className="text-gray-300">
<span className="text-emerald-400">curl</span> https://api.otpwave.com/v1/otp/send \
  -H <span className="text-yellow-300">"X-API-Key: $OTPWAVE_API_KEY"</span> \
  -H <span className="text-yellow-300">"Content-Type: application/json"</span> \
  -d '{'{'}
    <span className="text-blue-300">"phoneNumber"</span>: <span className="text-orange-300">"{phone || "+15551234567"}"</span>,
    <span className="text-blue-300">"appName"</span>: <span className="text-orange-300">"{appName}"</span>,
    <span className="text-blue-300">"length"</span>: <span className="text-purple-300">{length}</span>,
    <span className="text-blue-300">"alphabet"</span>: <span className="text-orange-300">"{alphabet}"</span>,
    <span className="text-blue-300">"ttlSeconds"</span>: <span className="text-purple-300">{ttl}</span>
  {'}'}'
              </code>
            </pre>
          </div>
          <div className="mt-4 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border/40 inline-block">
            Need an API key?{" "}
            <Link href="/dashboard/api-keys" className="text-primary font-medium hover:underline underline-offset-4">
              Manage API keys
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
