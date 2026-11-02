import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Check, Code2,
  Inbox, KeyRound, ShieldCheck, Smartphone, Webhook
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://otpwave-api.fly.dev";
const curlExample = [
  `curl -X POST ${apiUrl}/v1/otp/send \\`,
  `  -H "X-API-Key: $OTPWAVE_API_KEY" \\`,
  `  -H "Content-Type: application/json" \\`,
  `  -d '{"phoneNumber":"+15555550100","appName":"Acme"}'`
].join("\n");

const capabilities = [
  { n: "01", title: "Conversations", text: "Read and reply to WhatsApp chats in a focused, live inbox.", href: "/dashboard/inbox", action: "Explore the inbox", icon: Inbox },
  { n: "02", title: "Your WhatsApp", text: "Pair your own account and keep its connection status close at hand.", href: "/dashboard/whatsapp", action: "Connect an account", icon: Smartphone },
  { n: "03", title: "OTP delivery", text: "Send verification codes from your server and follow each delivery.", href: "/docs#send-an-otp", action: "Read the API guide", icon: KeyRound },
  { n: "04", title: "Developer access", text: "Manage API keys, webhooks, and OAuth access for MCP clients.", href: "/docs#mcp", action: "Explore integrations", icon: Bot }
];

export default function MarketingPage() {
  return (
    <main id="top" className="marketing-site min-h-screen overflow-hidden bg-[#f9faf7] text-[#151a18]">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>

      <section id="main-content" aria-labelledby="hero-title" tabIndex={-1} className="editorial-scene relative isolate min-h-[820px] overflow-hidden scroll-mt-20 sm:min-h-[910px]">
        <header className="relative z-30 px-4 pt-4 sm:px-7 sm:pt-6">
          <div className="mx-auto flex min-h-[60px] max-w-[1320px] items-center justify-between gap-4 rounded-full border border-white/70 bg-white/70 px-4 shadow-[0_8px_35px_rgba(45,65,61,.07)] backdrop-blur-md sm:min-h-[68px] sm:px-6">
            <Brand className="shrink-0 text-[#151a18]" markClassName="h-8 w-8 text-[#45695d]" />
            <nav aria-label="Main navigation" className="hidden items-center gap-8 text-[13px] font-medium text-[#4f5c58] lg:flex">
              <a href="#platform" className="transition-colors hover:text-[#151a18]">Platform</a>
              <a href="#workflows" className="transition-colors hover:text-[#151a18]">How it works</a>
              <Link href="/docs" className="transition-colors hover:text-[#151a18]">Developers</Link>
            </nav>
            <div className="hidden items-center gap-5 sm:flex">
              <Link href="/login" className="px-1 py-2 text-sm font-medium text-[#4f5c58] transition-colors hover:text-[#151a18]">Log in</Link>
              <Button asChild className="h-10 px-5"><Link href="/signup">Open workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
            </div>
            <details className="relative sm:hidden">
              <summary aria-label="Open navigation menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-[#151a18]/15 text-[#151a18] [&::-webkit-details-marker]:hidden">
                <span className="grid gap-1"><i className="h-px w-4 bg-current" /><i className="h-px w-4 bg-current" /></span>
              </summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-12 z-50 grid w-[min(84vw,300px)] gap-1 rounded-2xl border border-[#151a18]/10 bg-[#fbfcf9] p-2 text-[#151a18] shadow-xl">
                <a href="#platform" className="rounded-xl px-3 py-3 text-sm hover:bg-[#edf2ef]">Platform</a>
                <a href="#workflows" className="rounded-xl px-3 py-3 text-sm hover:bg-[#edf2ef]">How it works</a>
                <Link href="/docs" className="rounded-xl px-3 py-3 text-sm hover:bg-[#edf2ef]">Developer docs</Link>
                <Link href="/login" className="rounded-xl px-3 py-3 text-sm hover:bg-[#edf2ef]">Log in</Link>
                <Button asChild className="mt-1 h-11"><Link href="/signup">Open workspace <ArrowRight className="h-4 w-4" /></Link></Button>
              </nav>
            </details>
          </div>
        </header>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60%] bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,255,255,.8),transparent_68%)]" />
        <div className="hero-content relative z-10 mx-auto flex max-w-[1120px] flex-col items-center px-5 pb-0 pt-16 text-center sm:px-8 sm:pt-20 lg:pt-[5.4rem]">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#45695d]/15 bg-white/60 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#45695d] sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[#45695d]" /> WhatsApp + OTP operations
          </p>
          <h1 id="hero-title" className="mt-6 max-w-[900px] text-balance text-[clamp(3.2rem,8.2vw,6.6rem)] leading-[.9] text-[#17201d]">
            Every message,<br className="hidden sm:block" /> in its right place.
          </h1>
          <p className="mt-5 max-w-[570px] text-[15px] leading-7 text-[#46534f] sm:mt-6 sm:text-lg sm:leading-8">
            WhatsApp conversations, verification delivery, and the tools behind them—together in one considered workspace.
          </p>
          <div className="hero-actions mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-[50px] w-full px-6 sm:w-auto"><Link href="/signup">Open your workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg" className="h-[50px] w-full border-[#151a18]/15 bg-white/50 px-6 text-[#151a18] hover:bg-white/80 sm:w-auto"><a href="#platform">See what you can do <ArrowDownRight aria-hidden="true" className="h-4 w-4" /></a></Button>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#4d5a56] sm:text-sm">
            <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-[#45695d]" /> Your own WhatsApp account</span>
            <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-[#45695d]" /> API and MCP access</span>
          </div>

          <div className="hero-product-preview relative mt-12 w-full max-w-[870px] text-left sm:mt-14">
            <div className="absolute -inset-x-4 -bottom-8 top-8 -z-10 rounded-[32px] bg-[#f8f9f5]/45 blur-xl" />
            <div className="overflow-hidden rounded-[20px] border border-[#23332e]/15 bg-[#fbfcfa] shadow-[0_28px_70px_-34px_rgba(26,43,37,.42)] sm:rounded-[24px]">
              <div className="flex h-11 items-center justify-between border-b border-[#1d2b27]/10 px-3 sm:h-12 sm:px-5">
                <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e4eeea] text-[#45695d]"><Inbox aria-hidden="true" className="h-3.5 w-3.5" /></span><span className="text-xs font-semibold text-[#27312e] sm:text-sm">OtpWave workspace</span></div>
                <span className="rounded-full bg-[#eef3ef] px-2.5 py-1 text-[9px] font-medium text-[#58645f] sm:text-[10px]">Workspace preview</span>
              </div>
              <div className="grid min-h-[180px] grid-cols-[120px_minmax(0,1fr)] sm:min-h-[230px] sm:grid-cols-[210px_minmax(0,1fr)]">
                <div className="border-r border-[#1d2b27]/10 bg-[#f4f6f2] p-2.5 sm:p-4">
                  <p className="px-1 pb-2 text-[8px] font-semibold uppercase tracking-[.13em] text-[#69746f] sm:pb-3 sm:text-[10px]">Workspace</p>
                  <div className="space-y-1 text-[9px] text-[#56615d] sm:space-y-1.5 sm:text-xs">
                    <div className="flex items-center gap-2 rounded-lg bg-[#e4eeea] px-2 py-2 font-medium text-[#29483d]"><Inbox className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Inbox</div>
                    <div className="flex items-center gap-2 px-2 py-2"><Smartphone className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> WhatsApp</div>
                    <div className="flex items-center gap-2 px-2 py-2"><KeyRound className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> API keys</div>
                    <div className="hidden items-center gap-2 px-2 py-2 sm:flex"><Webhook className="h-3.5 w-3.5" /> Webhooks</div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center justify-between border-b border-[#1d2b27]/10 px-3 py-2.5 sm:px-5 sm:py-3"><div><p className="text-[10px] font-semibold text-[#26312d] sm:text-sm">Inbox</p><p className="mt-0.5 text-[8px] text-[#74807a] sm:text-[10px]">Your conversations, in one place</p></div><span className="rounded-full border border-[#dce2dd] px-2 py-1 text-[8px] text-[#65716b] sm:text-[10px]">All chats</span></div>
                  <div className="grid flex-1 place-items-center px-3 py-5 text-center sm:py-8">
                    <div><span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#edf3ef] text-[#45695d] sm:h-10 sm:w-10"><Inbox aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" /></span><p className="mt-2 text-[10px] font-medium text-[#35413c] sm:mt-3 sm:text-xs">Your conversations appear here</p><p className="mt-1 text-[8px] text-[#7b8580] sm:text-[10px]">Connect WhatsApp to get started.</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-20 bg-[#f9faf7]">
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:px-12">
          <div className="grid gap-7 border-b border-[#151a18]/12 pb-8 sm:gap-10 md:grid-cols-[.8fr_1.2fr] md:items-end md:pb-12">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#557266]">One connected workspace</p><h2 className="mt-4 max-w-[13ch] text-[clamp(2.7rem,5.5vw,4.8rem)] leading-[.96]">Made for the conversation and what follows.</h2></div>
            <p className="max-w-xl text-[15px] leading-7 text-[#4d5854] sm:text-base sm:leading-8">Keep day-to-day messaging close to the API, delivery records, and account settings that power it. Move between tools without losing the thread.</p>
          </div>
          <div id="workflows" className="scroll-mt-24 divide-y divide-[#151a18]/10">
            {capabilities.map(({ n, title, text, href, action, icon: Icon }) => (
              <article key={n} className="grid gap-4 py-6 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-6 sm:py-7">
                <span className="font-mono text-xs text-[#73807a]">{n}</span>
                <div className="flex min-w-0 items-start gap-4"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e7efeb] text-[#45695d]"><Icon aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="text-xl leading-tight text-[#1a211f] sm:text-2xl">{title}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-[#59645f]">{text}</p></div></div>
                <Link href={href} className="inline-flex min-h-10 items-center gap-2 pl-14 text-sm font-semibold text-[#31473d] transition-colors hover:text-[#151a18] sm:pl-0">{action}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eef3f0]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-12">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#557266]">For developers</p><h2 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,5vw,4.4rem)] leading-[.96]">A direct path from request to delivery.</h2><p className="mt-4 max-w-lg text-[15px] leading-7 text-[#4d5854]">Create an API key, send one request from your server, and inspect delivery activity from the workspace.</p><Link href="/docs" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#31473d] hover:text-[#151a18]">Read the API docs <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></div>
          <div className="overflow-hidden rounded-[22px] border border-[#151a18]/10 bg-[#17211e] text-[#f0f3ef] shadow-[0_25px_65px_-38px_rgba(16,28,23,.55)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5"><div className="flex items-center gap-2 text-xs font-medium sm:text-sm"><Code2 aria-hidden="true" className="h-4 w-4 text-[#b8d7c8]" /> Send a verification code</div><span className="font-mono text-[10px] text-[#c3ddcb]">POST</span></div>
            <pre className="overflow-x-auto p-4 text-[10px] leading-6 text-[#e2eae4] sm:p-6 sm:text-xs"><code>{curlExample}</code></pre>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-4 py-3 text-[11px] text-[#c2cdc5] sm:px-5"><span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> API key authentication</span><span className="inline-flex items-center gap-1.5"><Webhook aria-hidden="true" className="h-3.5 w-3.5" /> Delivery webhooks</span></div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#dce9e6]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(255,255,255,.8),transparent_58%)]" />
        <div className="relative mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-20 lg:px-12">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#557266]">Start with your workspace</p><h2 className="mt-3 max-w-[15ch] text-3xl leading-tight sm:text-4xl">Keep every message moving.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#4d5854]">Connect WhatsApp, explore the inbox, and bring your delivery tools into one place.</p></div>
          <Button asChild size="lg" className="h-12 shrink-0 px-6"><Link href="/signup">Create your account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 border-t border-[#151a18]/10 px-5 py-7 text-xs text-[#5d6863] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand className="text-[#1b2521]" markClassName="h-7 w-7 text-[#45695d]" />
        <p>WhatsApp messaging and OTP operations.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/docs" className="hover:text-[#151a18]">Documentation</Link><Link href="/docs#mcp" className="hover:text-[#151a18]">MCP setup</Link><Link href="https://github.com/mohammadalibalwe48-hub/Whatsappppp" target="_blank" rel="noopener noreferrer" className="hover:text-[#151a18]">GitHub</Link></nav>
      </footer>
    </main>
  );
}
