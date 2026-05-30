"use client";

import { useState } from "react";
import { Copy, TerminalSquare, Key, Link2, ShieldCheck, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const baseUrl =
  (typeof window !== "undefined" && (process.env.NEXT_PUBLIC_API_URL as string)) ||
  "https://api.your-domain.com";

const curlSnippet = `curl -X POST ${baseUrl}/v1/otp/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $OTPWAVE_API_KEY" \\
  -d '{
    "phoneNumber": "+15555550100",
    "appName": "Acme"
  }'`;

const verifySnippet = `curl -X POST ${baseUrl}/v1/otp/verify \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: $OTPWAVE_API_KEY" \\
  -d '{
    "phoneNumber": "+15555550100",
    "code": "123456"
  }'`;

const nodeSnippet = `import fetch from "node-fetch";

const apiKey = process.env.OTPWAVE_API_KEY!;

async function sendOtp(phoneNumber: string) {
  const res = await fetch("${baseUrl}/v1/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ phoneNumber, appName: "Acme" })
  });
  if (!res.ok) throw new Error(\`OTP send failed: \${res.status}\`);
  return res.json() as Promise<{ otpId: string; expiresAt: string }>;
}

async function verifyOtp(phoneNumber: string, code: string) {
  const res = await fetch("${baseUrl}/v1/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ phoneNumber, code })
  });
  const body = await res.json();
  return body.status === "verified";
}`;

const pythonSnippet = `import os, requests

API_KEY = os.environ["OTPWAVE_API_KEY"]
BASE = "${baseUrl}"

def send_otp(phone: str) -> dict:
    r = requests.post(f"{BASE}/v1/otp/send",
        headers={"X-API-Key": API_KEY},
        json={"phoneNumber": phone, "appName": "Acme"})
    r.raise_for_status()
    return r.json()

def verify_otp(phone: str, code: str) -> bool:
    r = requests.post(f"{BASE}/v1/otp/verify",
        headers={"X-API-Key": API_KEY},
        json={"phoneNumber": phone, "code": code})
    return r.json().get("status") == "verified"`;

function CopyBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
         <Button
           size="sm"
           variant="secondary"
           className="h-8 shadow-sm"
           onClick={() => {
             navigator.clipboard.writeText(code);
             toast.success("Copied to clipboard");
           }}
         >
           <Copy className="h-3 w-3 mr-2" /> Copy
         </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-border/40 bg-[#0d1117] p-5 text-sm leading-relaxed shadow-inner">
        <code className="font-mono text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [tab, setTab] = useState("curl");
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">API documentation</h1>
        <p className="text-base text-muted-foreground mt-1">
          Integrate WhatsApp OTP verification into your app in under five minutes.
        </p>
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
             <Key className="h-5 w-5 text-primary" /> Authentication
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Pass your API key as the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-API-Key</code> header on every request. You can also use
            an <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">Authorization: Bearer</code> header — both are accepted.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
             <TerminalSquare className="h-5 w-5 text-primary" /> 1. Send an OTP
          </CardTitle>
          <CardDescription className="mt-2">
            <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">POST /v1/otp/send</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/40 p-1">
              <TabsTrigger value="curl" className="rounded-md">cURL</TabsTrigger>
              <TabsTrigger value="node" className="rounded-md">Node.js</TabsTrigger>
              <TabsTrigger value="python" className="rounded-md">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="mt-0">
              <CopyBlock code={curlSnippet} />
            </TabsContent>
            <TabsContent value="node" className="mt-0">
              <CopyBlock code={nodeSnippet} />
            </TabsContent>
            <TabsContent value="python" className="mt-0">
              <CopyBlock code={pythonSnippet} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" /> 2. Verify the OTP
          </CardTitle>
          <CardDescription className="mt-2">
            <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">POST /v1/otp/verify</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyBlock code={verifySnippet} />
          <p className="text-sm text-muted-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-lg border border-border/40">
            On success the response is <code className="text-success font-mono">{`{ "ok": true, "status": "verified" }`}</code>.
            Otherwise the <code className="font-mono text-foreground">status</code> field is one of <code className="text-destructive font-mono">invalid</code>,{" "}
            <code className="text-destructive font-mono">expired</code>, or <code className="text-destructive font-mono">not_found</code>.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Link2 className="h-5 w-5 text-primary" /> All Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Endpoint method="POST" path="/v1/otp/send" desc="Generate and deliver a fresh OTP." />
          <Endpoint method="POST" path="/v1/otp/verify" desc="Verify an OTP submitted by the end user." />
          <Endpoint method="POST" path="/v1/otp/resend" desc="Resend the most recent OTP (rate limited)." />
          <Endpoint method="GET" path="/v1/otp/{id}" desc="Look up the status of an OTP." />
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
             <FileCode2 className="h-5 w-5 text-primary" /> Webhook signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground/90 leading-relaxed">
          <p>
            Every webhook delivery includes an <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">x-otpwave-signature</code> header of the form{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>. To verify, recompute{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">HMAC_SHA256(secret, &quot;&lt;timestamp&gt;.&lt;raw_body&gt;&quot;)</code> and
            compare with constant-time equality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = method === "POST" ? "bg-primary/10 text-primary border-primary/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border/40 bg-card/40 p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
         <span className={`rounded-md px-2.5 py-1 text-xs font-bold font-mono border shadow-sm ${methodColor}`}>
           {method}
         </span>
         <span className="font-mono text-sm font-semibold text-foreground/90">{path}</span>
      </div>
      <span className="sm:ml-auto text-sm text-muted-foreground/80">{desc}</span>
    </div>
  );
}
