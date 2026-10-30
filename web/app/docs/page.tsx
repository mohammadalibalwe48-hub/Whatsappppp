import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Code2, KeyRound, MessageSquare, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://otpwave-api.fly.dev";
const mcpUrl = `${apiUrl}/mcp`;
const curlExample = `curl -X POST ${apiUrl}/v1/otp/send \\
  -H "X-API-Key: $OTPWAVE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phoneNumber":"+15555550100","appName":"Acme"}'`;

export const metadata = {
  title: "Documentation | OtpWave",
  description: "Quickstart guide for WhatsApp OTP delivery and the OtpWave MCP server."
};

export default function PublicDocsPage() {
  return (
    <main className="min-h-screen bg-background">
      <a href="#docs-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to documentation</a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" /></span><span>OtpWave</span></Link>
          <nav aria-label="Documentation navigation" className="flex items-center gap-2 sm:gap-4"><Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">Home</Link><Button asChild size="sm"><Link href="/signup">Create account</Link></Button></nav>
        </div>
      </header>

      <div id="docs-content" className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <aside className="h-fit rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-24">
          <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">On this page</p>
          <nav aria-label="On this page" className="grid gap-1 text-sm">
            <a href="#overview" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Overview</a>
            <a href="#send-an-otp" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Send an OTP</a>
            <a href="#mcp" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Connect an AI client</a>
            <a href="#dashboard" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Explore the dashboard</a>
          </nav>
        </aside>

        <article className="min-w-0 space-y-14">
          <section id="overview" className="scroll-mt-28">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Documentation</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Build with OtpWave</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Send WhatsApp verification codes with the HTTP API, manage conversations in your inbox, or connect an AI assistant through MCP.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <QuickLink icon={<Code2 aria-hidden="true" className="h-4 w-4" />} title="REST API" detail="API key" href="#send-an-otp" />
              <QuickLink icon={<Bot aria-hidden="true" className="h-4 w-4" />} title="MCP server" detail="OAuth sign-in" href="#mcp" />
              <QuickLink icon={<Smartphone aria-hidden="true" className="h-4 w-4" />} title="WhatsApp inbox" detail="In your dashboard" href="#dashboard" />
            </div>
          </section>

          <section id="send-an-otp" className="scroll-mt-28 border-t border-border pt-10">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">REST API</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Send an OTP</h2></div></div>
            <p className="mt-4 leading-7 text-muted-foreground">Create an API key in your account, then include it in the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">X-API-Key</code> header. Keep the key in your server environment; never expose it in browser code.</p>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#171513] text-[#eee7e2]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-medium"><Code2 aria-hidden="true" className="h-4 w-4 text-primary" /> cURL</div>
              <pre className="overflow-x-auto p-4 text-xs leading-6 sm:p-5 sm:text-sm"><code>{curlExample}</code></pre>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">The response includes an <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">otpId</code> and expiration time. Verify with <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">POST /v1/otp/verify</code> and the same API key.</p>
            <Button asChild variant="outline" className="mt-5"><Link href="/signup">Create an API key <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
          </section>

          <section id="mcp" className="scroll-mt-28 border-t border-border pt-10">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bot aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">AI integrations</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Connect an AI client</h2></div></div>
            <p className="mt-4 leading-7 text-muted-foreground">Use OtpWave’s remote MCP server with Codex, ChatGPT, and compatible MCP clients. Sign in through the browser and approve access with your OtpWave account. OAuth does not require you to paste an API key into the AI client.</p>
            <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">MCP server URL</p>
              <code className="mt-2 block break-all rounded-xl bg-muted px-3 py-3 font-mono text-sm text-foreground">{mcpUrl}</code>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
              <p className="font-medium">Codex CLI</p>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#171513] p-4 text-xs leading-6 text-[#eee7e2] sm:text-sm"><code>{`codex mcp add otpwave --url ${mcpUrl}\ncodex mcp login otpwave`}</code></pre>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">The login command opens OtpWave in your browser. Sign in and approve account access.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4"><p className="font-medium">ChatGPT</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Add a remote MCP server using the URL above, choose OAuth, then sign in to OtpWave and approve access. Reconnect an existing setup if it needs updated permissions.</p></div>
              <div className="rounded-2xl border border-border bg-card p-4"><p className="font-medium">What it can do</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Manage WhatsApp pairing, browse and search chats, send and reply to messages, share media and locations, manage chats and groups, and work with OTPs and account settings.</p></div>
            </div>
            <div className="mt-4 flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.045] p-4 text-sm leading-6"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Review each access prompt. A QR code is a one-time WhatsApp login credential; scan it only with your own phone.</p></div>
          </section>

          <section id="dashboard" className="scroll-mt-28 border-t border-border pt-10">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Explore the dashboard</h2></div></div>
            <p className="mt-4 leading-7 text-muted-foreground">After signing in, use the workspace menu to open Inbox, WhatsApp, API keys, OTP logs, analytics, webhooks, and settings. On mobile, open the menu button at the top left.</p>
            <Button asChild className="mt-5"><Link href="/signup">Open OtpWave <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
          </section>
        </article>
      </div>
      <footer className="border-t border-border py-6"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>OtpWave documentation</span><Link href="/" className="font-medium text-foreground hover:text-primary">Back to home</Link></div></footer>
    </main>
  );
}

function QuickLink({ icon, title, detail, href }: { icon: React.ReactNode; title: string; detail: string; href: string }) {
  return <a href={href} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span></a>;
}
