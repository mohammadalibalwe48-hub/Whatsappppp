import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Check, Code2,
  Inbox, KeyRound, ShieldCheck, Smartphone, Webhook
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { GlassOrbCluster } from "@/components/glass-orb-cluster";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://otpwave-api.fly.dev";
const curlExample = [
  `curl -X POST ${apiUrl}/v1/otp/send \\`,
  `  -H "X-API-Key: $OTPWAVE_API_KEY" \\`,
  `  -H "Content-Type: application/json" \\`,
  `  -d '{"phoneNumber":"+15555550100","appName":"Acme"}'`
].join("\n");

const capabilities = [
  { n: "01", title: "Conversations", text: "A focused place to read, find, and reply to WhatsApp chats.", href: "/dashboard/inbox", action: "Open the inbox", icon: Inbox },
  { n: "02", title: "Your WhatsApp", text: "Pair your own account and keep its live connection in view.", href: "/dashboard/whatsapp", action: "Connect an account", icon: Smartphone },
  { n: "03", title: "OTP delivery", text: "Send verification codes, inspect delivery, and receive webhook events.", href: "/docs#send-an-otp", action: "Read the API guide", icon: KeyRound },
  { n: "04", title: "Developer access", text: "Use scoped keys, API tools, and OAuth access for MCP clients.", href: "/docs#mcp", action: "Explore integrations", icon: Bot }
];

export default function MarketingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0c0b0a] text-[#f4efec]">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto flex min-h-[60px] max-w-[1370px] items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#171513]/95 px-4 shadow-[0_16px_60px_rgba(0,0,0,.32)] backdrop-blur sm:min-h-[68px] sm:px-6 lg:px-8">
          <Brand className="shrink-0 text-[#f4efec]" markClassName="h-8 w-8 text-[#e9dfda]" />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-medium text-[#c1b8b3] lg:flex">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#workflows" className="transition-colors hover:text-white">Workflows</a>
            <Link href="/docs" className="transition-colors hover:text-white">Developers</Link>
          </nav>
          <div className="hidden items-center gap-5 sm:flex">
            <Link href="/login" className="px-1 py-2 text-sm font-medium text-[#c1b8b3] hover:text-white">Log in</Link>
            <Button asChild className="h-11 rounded-md px-5 text-sm"><Link href="/signup">Open workspace <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <details className="relative sm:hidden">
            <summary aria-label="Open navigation menu" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-white/10 text-white [&::-webkit-details-marker]:hidden">
              <span className="grid gap-1"><i className="h-px w-4 bg-current" /><i className="h-px w-4 bg-current" /></span>
            </summary>
            <nav aria-label="Mobile navigation" className="absolute right-0 top-12 z-50 grid w-[min(84vw,300px)] gap-1 rounded-xl border border-white/10 bg-[#171513] p-2 shadow-2xl">
              <a href="#platform" className="rounded-lg px-3 py-3 text-sm text-[#d8ceca] hover:bg-white/[0.06]">Platform</a>
              <a href="#workflows" className="rounded-lg px-3 py-3 text-sm text-[#d8ceca] hover:bg-white/[0.06]">Workflows</a>
              <Link href="/docs" className="rounded-lg px-3 py-3 text-sm text-[#d8ceca] hover:bg-white/[0.06]">Developer docs</Link>
              <Link href="/login" className="rounded-lg px-3 py-3 text-sm text-[#d8ceca] hover:bg-white/[0.06]">Log in</Link>
              <Button asChild className="mt-1 h-11"><Link href="/signup">Open workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </nav>
          </details>
        </div>
      </header>

      <section id="main-content" aria-labelledby="hero-title" tabIndex={-1} className="relative scroll-mt-24 overflow-hidden">
        <div aria-hidden="true" className="halftone-band pointer-events-none absolute left-0 top-[48%] h-16 w-full opacity-55 sm:top-[53%] sm:h-20" />
        <div aria-hidden="true" className="halftone-band pointer-events-none absolute right-0 top-0 h-14 w-[72%] opacity-25" />
        <div className="relative mx-auto grid min-h-[660px] max-w-[1370px] items-center gap-0 px-5 pb-10 pt-16 sm:min-h-[700px] sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:py-20">
          <div className="relative z-10 max-w-[700px]">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-[#171513] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#c7bcb7] sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> WhatsApp + OTP operations
            </div>
            <h1 id="hero-title" className="mt-8 max-w-[12ch] text-[clamp(2.75rem,10.5vw,5.6rem)] font-medium leading-[.98] tracking-[-0.065em] sm:mt-9 sm:text-6xl lg:text-[5.6rem]">
              Messaging built for <span className="text-primary">real work.</span>
            </h1>
            <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-[#b7ada7] sm:mt-7 sm:text-lg sm:leading-8">
              Bring WhatsApp conversations, verification messages, and delivery operations into one focused workspace.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg" className="h-[54px] w-full rounded-md px-6 text-base sm:w-auto"><Link href="/signup">Open your workspace <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-[54px] w-full rounded-md border-white/15 bg-white/[0.025] px-6 text-base text-white hover:bg-white/10 hover:text-white sm:w-auto"><a href="#platform">See how it works <ArrowDownRight aria-hidden="true" className="ml-2 h-4 w-4" /></a></Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-[#a39a95] sm:text-sm">
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Your own WhatsApp account</span>
              <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> API + MCP access</span>
            </div>
          </div>
          <div className="relative hidden h-[440px] w-full max-w-[550px] justify-self-end sm:block lg:h-[520px]" aria-hidden="true">
            <GlassOrbCluster className="absolute inset-0 scale-[.88] lg:scale-100" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#161311]/90 px-4 py-2.5 text-xs tracking-wide text-[#c8beb8] shadow-xl"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" /> Conversations · OTPs · Integrations</div>
          </div>
        </div>
        <div className="relative mx-auto flex max-w-[1370px] flex-col gap-4 border-t border-white/[0.08] px-5 py-5 text-xs text-[#a99f99] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6 lg:px-12">
          <p className="max-w-md leading-5">One workspace for the people who run messaging and the developers who build with it.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d7cfcb]"><span>Inbox</span><span>WhatsApp</span><span>API</span><span>Webhooks</span><span>MCP</span></div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-24 border-y border-white/[0.08] bg-[#11100f]">
        <div className="mx-auto max-w-[1370px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid gap-7 border-b border-white/10 pb-8 sm:gap-10 md:grid-cols-[.8fr_1.2fr] md:items-end md:pb-12">
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">The workspace</p><h2 className="mt-4 max-w-[13ch] text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">Built around the work, not the noise.</h2></div>
            <p className="max-w-xl text-sm leading-7 text-[#b7ada7] sm:text-base sm:leading-8">One connected workspace for the conversation, the delivery, and the systems behind it. Open only the tools you need and keep their status close.</p>
          </div>
          <div id="workflows" className="scroll-mt-24 divide-y divide-white/10">
            {capabilities.map(({ n, title, text, href, action, icon: Icon }) => (
              <article key={n} className="grid gap-4 py-6 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-6 sm:py-7">
                <span className="font-mono text-xs text-[#837a75]">{n}</span>
                <div className="flex min-w-0 items-start gap-4"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-primary"><Icon aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="text-lg font-medium tracking-tight sm:text-xl">{title}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-[#a99f99]">{text}</p></div></div>
                <Link href={href} className="inline-flex min-h-10 items-center gap-2 pl-14 text-sm font-medium text-[#e9dfda] hover:text-primary sm:pl-0">{action}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="halftone-band pointer-events-none absolute right-0 top-[42%] h-12 w-full opacity-30" />
        <div className="relative mx-auto grid max-w-[1370px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-12 lg:py-24">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">For developers</p><h2 className="mt-4 max-w-[12ch] text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">A direct path from API to delivery.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-[#b7ada7] sm:text-base">Create a key, send one request, and follow each result in your workspace.</p><Link href="/docs" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#eee6e1] hover:text-primary">Read the API docs <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#151311] text-[#eee7e2] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5"><div className="flex items-center gap-2 text-xs font-medium"><Code2 aria-hidden="true" className="h-4 w-4 text-primary" /> Send a verification code</div><span className="font-mono text-[10px] text-primary">POST</span></div>
            <pre className="overflow-x-auto p-4 text-[10px] leading-6 sm:p-6 sm:text-xs"><code>{curlExample}</code></pre>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-4 py-3 text-[11px] text-[#aea39c] sm:px-5"><span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> API key authentication</span><span className="inline-flex items-center gap-1.5"><Webhook aria-hidden="true" className="h-3.5 w-3.5" /> Delivery webhooks</span></div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[#171513]">
        <div className="mx-auto flex max-w-[1370px] flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-12 lg:px-12">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Start with your workspace</p><h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">Keep every message moving.</h2></div>
          <Button asChild size="lg" className="h-12 rounded-md px-6"><Link href="/signup">Create your account <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1370px] flex-col gap-5 px-5 py-7 text-xs text-[#988e88] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand className="text-[#eee7e2]" markClassName="h-7 w-7" />
        <p>WhatsApp messaging and OTP operations.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/docs" className="hover:text-white">Documentation</Link><Link href="/docs#mcp" className="hover:text-white">MCP setup</Link><Link href="https://github.com/mohammadalibalwe48-hub/Whatsappppp" target="_blank" rel="noopener noreferrer" className="hover:text-white">GitHub</Link></nav>
      </footer>
    </main>
  );
}
