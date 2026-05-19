"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
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
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2"
        onClick={() => {
          navigator.clipboard.writeText(code);
          toast.success("Copied");
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function DocsPage() {
  const [tab, setTab] = useState("curl");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API documentation</h1>
        <p className="text-sm text-muted-foreground">
          Add WhatsApp OTP verification to your app in under five minutes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Pass your API key as the <code>X-API-Key</code> header on every request. You can also use
            an <code>Authorization: Bearer</code> header — both are accepted.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Send an OTP</CardTitle>
          <CardDescription>
            <code>POST /v1/otp/send</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <CopyBlock code={curlSnippet} />
            </TabsContent>
            <TabsContent value="node">
              <CopyBlock code={nodeSnippet} />
            </TabsContent>
            <TabsContent value="python">
              <CopyBlock code={pythonSnippet} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Verify the OTP</CardTitle>
          <CardDescription>
            <code>POST /v1/otp/verify</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyBlock code={verifySnippet} />
          <p className="mt-3 text-sm text-muted-foreground">
            On success the response is <code>{`{ "ok": true, "status": "verified" }`}</code>.
            Otherwise the <code>status</code> field is one of <code>invalid</code>,{" "}
            <code>expired</code>, or <code>not_found</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Endpoint method="POST" path="/v1/otp/send" desc="Generate and deliver a fresh OTP." />
          <Endpoint method="POST" path="/v1/otp/verify" desc="Verify an OTP submitted by the end user." />
          <Endpoint method="POST" path="/v1/otp/resend" desc="Resend the most recent OTP (rate limited)." />
          <Endpoint method="GET" path="/v1/otp/{id}" desc="Look up the status of an OTP." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook signatures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every webhook delivery includes an <code>x-otpwave-signature</code> header of the form{" "}
            <code>t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>. To verify, recompute{" "}
            <code>HMAC_SHA256(secret, &quot;&lt;timestamp&gt;.&lt;raw_body&gt;&quot;)</code> and
            compare with constant-time equality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2">
      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
        {method}
      </span>
      <span className="font-mono text-sm">{path}</span>
      <span className="ml-auto text-sm text-muted-foreground">{desc}</span>
    </div>
  );
}
