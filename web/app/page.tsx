import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Inbox,
  KeyRound,
  MessageSquare,
  Menu,
  ShieldCheck,
  Smartphone,
  Webhook
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassOrbCluster } from "@/components/glass-orb-cluster";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://otpwave-api.fly.dev";

const curlExample = `curl -X POST ${apiUrl}/v1/otp/send \\
  -H "X-API-Key: $OTPWAVE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phoneNumber":"+15555550100","appName":"Acme"}'`;

const features = [
  {
    icon: Inbox,
    eyebrow: "Conversations",
    title: "A real WhatsApp inbox",
    copy: "Read recent chats, find messages, reply in context, share media, and keep conversations organized.",
    href: "/dashboard/inbox",
    link: "Explore the inbox"
  },
  {
    icon: Smartphone,
    eyebrow: "Your account",
    title: "Connect your own WhatsApp",
    copy: "Pair once with a QR code and see your connection status from the same workspace you use to message.",
    href: "/dashboard/whatsapp",
    link: "See connection setup"
  },
  {
    icon: Code2,
    eyebrow: "For developers",
    title: "Send OTPs through an API",
    copy: "Create scoped API keys, send and verify codes, inspect delivery logs, and configure webhooks.",
    href: "/docs#send-an-otp",
    link: "Read the quickstart"
  },
  {
    icon: Bot,
    eyebrow: "AI access",
    title: "Connect through MCP",
    copy: "Sign in with your OtpWave account from Codex, ChatGPT, and compatible MCP clients. No API key needed for OAuth.",
    href: "/docs#mcp",
    link: "Set up an AI client"
  }
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>

      <header className="sticky top-0 z-40 bg-background/90 px-3 pt-3 backdrop-blur sm:px-5">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between rounded-2xl border border-white/[0.09] bg-[#171513]/90 px-4 shadow-2xl shadow-black/20 sm:px-6 lg:px-7">
          <Link href="/" className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" /></span>
            <span className="text-lg">OtpWave</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <Link href="/docs" className="transition-colors hover:text-foreground">Developers</Link>
            <Link href="/dashboard/inbox" className="transition-colors hover:text-foreground">Inbox</Link>
          </nav>
          <details className="relative md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" className="h-4 w-4" /><span>Menu</span></summary>
            <nav aria-label="Main navigation" className="absolute right-0 top-12 z-50 grid w-52 gap-1 rounded-xl border border-border bg-card p-2 text-sm font-medium shadow-lg">
              <a href="#features" className="rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground">Features</a>
              <Link href="/docs" className="rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground">Developers</Link>
              <Link href="/dashboard/inbox" className="rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground">Inbox</Link>
            </nav>
          </details>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden min-[420px]:inline-flex rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Log in</Link>
            <Button asChild size="sm" className="h-10 px-4 sm:px-5"><Link href="/signup">Open workspace <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <section id="main-content" aria-labelledby="hero-title" tabIndex={-1} className="relative scroll-mt-20 overflow-hidden">
        <div aria-hidden="true" className="halftone-band absolute left-0 top-[56%] h-16 w-full opacity-65" />
        <div aria-hidden="true" className="halftone-band absolute right-0 top-0 h-12 w-[70%] opacity-30" />
        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-5 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1b1715] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#c9beb8]">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> WhatsApp + OTP operations
            </div>
            <h1 id="hero-title" className="mt-7 max-w-[13ch] text-[3.2rem] font-medium leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[5.25rem]">
              Messaging built for <span className="text-primary">real work.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#b7ada7] sm:text-lg sm:leading-8">
              Bring WhatsApp conversations, verification messages, and delivery operations into one focused workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base"><Link href="/signup">Open your workspace <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-white/15 bg-white/[0.035] px-6 text-base text-white hover:bg-white/10 hover:text-white"><Link href="/docs">See how it works <ArrowDownRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#9c928c] sm:text-sm">
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Your own WhatsApp account</span>
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> API + MCP access</span>
            </div>
          </div>

          <div className="relative mx-auto h-[330px] w-full max-w-[500px] sm:h-[430px]" aria-hidden="true">
            <GlassOrbCluster className="absolute inset-0 scale-[0.78] sm:scale-100" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-[#161311]/90 px-4 py-2 text-[11px] tracking-wide text-[#c8beb8] shadow-xl sm:bottom-7"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" /> One workspace · three workflows</div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Everything within reach</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One account. A complete messaging toolkit.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">The tools you need are easy to find from the workspace, on desktop and mobile.</p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, eyebrow, title, copy, href, link }) => (
              <article key={title} className="flex min-h-[255px] flex-col rounded-2xl border border-border bg-background p-5 sm:p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{copy}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:rounded-sm">{link}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="send-an-otp" className="scroll-mt-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound aria-hidden="true" className="h-5 w-5" /></span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Start with one API request.</h2>
            <p className="mt-4 max-w-lg leading-7 text-muted-foreground">Create an API key in your dashboard, then send a verification code with a small HTTP request. Delivery status and logs stay in your workspace.</p>
            <Button asChild variant="outline" className="mt-6"><Link href="/docs#send-an-otp">Read the API guide <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#171513] text-[#eee7e2] shadow-2xl shadow-black/25">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5"><div className="flex items-center gap-2"><Code2 aria-hidden="true" className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Send a verification code</span></div><span className="rounded-md bg-white/[0.07] px-2 py-1 font-mono text-[10px] text-primary">POST</span></div>
            <pre className="overflow-x-auto p-4 text-[11px] leading-6 sm:p-6 sm:text-sm"><code>{curlExample}</code></pre>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-4 py-3 text-xs text-[#aea39c] sm:px-5"><span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> API key authentication</span><span className="inline-flex items-center gap-1.5"><Webhook aria-hidden="true" className="h-3.5 w-3.5" /> Delivery webhooks</span></div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-primary/[0.045]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><h2 className="text-2xl font-semibold tracking-tight">Ready to get connected?</h2><p className="mt-2 text-sm text-muted-foreground">Create your account, pair WhatsApp, and explore your inbox.</p></div>
          <Button asChild size="lg"><Link href="/signup">Create your account <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link href="/" className="flex w-fit items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><MessageSquare aria-hidden="true" className="h-4 w-4" /></span>OtpWave</Link>
        <p className="text-muted-foreground">WhatsApp messaging and OTP tools in one workspace.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground"><Link href="/docs" className="hover:text-foreground">Documentation</Link><Link href="/docs#mcp" className="hover:text-foreground">MCP setup</Link><Link href="https://github.com/mohammadalibalwe48-hub/Whatsappppp" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub <span className="sr-only">(opens in a new tab)</span></Link></nav>
      </footer>
    </main>
  );
}
