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
    <main id="top" className="marketing-site dp-marketing min-h-screen overflow-hidden">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-card px-4 py-2 font-semibold text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>

      <section id="main-content" aria-labelledby="hero-title" tabIndex={-1} className="dp-hero relative isolate scroll-mt-20 px-4 pb-12 pt-4 sm:px-7 sm:pt-6">
        <header className="relative z-30 mx-auto max-w-[1320px]">
          <div className="dp-nav-shell flex min-h-[62px] items-center justify-between gap-4 px-4 sm:min-h-[72px] sm:px-6">
            <Brand className="shrink-0 text-foreground" markClassName="h-8 w-8 text-primary" />
            <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-semibold text-muted-foreground lg:flex">
              <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
              <a href="#workflows" className="transition-colors hover:text-foreground">How it works</a>
              <Link href="/docs" className="transition-colors hover:text-foreground">Developers</Link>
            </nav>
            <div className="hidden items-center gap-5 sm:flex">
              <Link href="/login" className="px-1 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary">Log in</Link>
              <Button asChild className="h-10 px-5"><Link href="/signup">Open workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
            </div>
            <details className="relative sm:hidden">
              <summary aria-label="Open navigation menu" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-[14px] border-2 border-foreground bg-card text-foreground shadow-[3px_3px_0_var(--dp-color-outline)] [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="grid gap-1"><i className="h-0.5 w-4 bg-current" /><i className="h-0.5 w-4 bg-current" /></span>
              </summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-14 z-50 grid w-[min(84vw,300px)] gap-1 rounded-[20px] border-[3px] border-foreground bg-card p-2 text-foreground shadow-[6px_6px_0_var(--dp-color-accent)]">
                <a href="#platform" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent">Platform</a>
                <a href="#workflows" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent">How it works</a>
                <Link href="/docs" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent">Developer docs</Link>
                <Link href="/login" className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent">Log in</Link>
                <Button asChild className="mt-1 h-11"><Link href="/signup">Open workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
              </nav>
            </details>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1320px] items-center gap-5 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_.85fr] lg:gap-10 lg:pt-[5.2rem]">
          <div className="dp-hero-copy relative z-10 max-w-[660px] px-1 sm:px-3 md:py-8 lg:max-w-none">
            <p className="inline-flex items-center gap-2 rounded-[14px] border-2 border-foreground bg-card px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.14em] shadow-[3px_3px_0_var(--dp-color-accent-warm)] sm:text-xs">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-foreground bg-[var(--dp-color-accent-secondary)]" /> WhatsApp + OTP operations
            </p>
            <h1 id="hero-title" className="mt-6 max-w-none text-balance text-[clamp(2.7rem,10vw,3.1rem)] leading-[.96] lg:text-[clamp(3.8rem,6vw,6.45rem)] lg:leading-[.91]">
              Every message,<br /> in its right place.
            </h1>
            <p className="mt-5 max-w-[550px] text-base leading-7 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
              WhatsApp conversations, verification delivery, and the tools behind them—together in one considered workspace.
            </p>
            <div className="hero-actions mt-7 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="h-[52px] w-full px-6 sm:w-auto"><Link href="/signup">Open your workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg" className="h-[52px] w-full px-6 sm:w-auto"><a href="#platform">See what you can do <ArrowDownRight aria-hidden="true" className="h-4 w-4" /></a></Button>
            </div>
          </div>

          <div className="dp-hero-art mx-auto h-[330px] w-full max-w-[570px] sm:h-[390px] lg:h-[440px]" role="img" aria-label="OtpWave workspace preview showing the inbox and developer tools.">
            <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 560 440" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="92" cy="92" r="51" fill="#252B3A" />
              <circle cx="84" cy="84" r="51" fill="#FFD05B" stroke="#252B3A" strokeWidth="4" />
              <circle cx="443" cy="82" r="26" fill="#252B3A" />
              <circle cx="436" cy="75" r="26" fill="#FF78C5" stroke="#252B3A" strokeWidth="4" />
              <path d="M69 339V260C69 220 100 189 140 189C180 189 211 220 211 260V339H69Z" fill="#252B3A" />
              <path d="M61 330V251C61 211 92 180 132 180C172 180 203 211 203 251V330H61Z" fill="#9BF1CD" stroke="#252B3A" strokeWidth="4" />
              <rect x="378" y="269" width="113" height="113" rx="28" fill="#252B3A" />
              <rect x="370" y="261" width="113" height="113" rx="28" fill="#6434DF" stroke="#252B3A" strokeWidth="4" />
              <circle cx="330" cy="117" r="15" fill="#252B3A" />
              <circle cx="323" cy="110" r="15" fill="#FFD05B" stroke="#252B3A" strokeWidth="4" />
              <path d="M270 38L292 78H248L270 38Z" fill="#252B3A" />
              <path d="M262 30L284 70H240L262 30Z" fill="#FF78C5" stroke="#252B3A" strokeLinejoin="round" strokeWidth="4" />
              <circle cx="284" cy="372" r="19" fill="#252B3A" />
              <circle cx="276" cy="364" r="19" fill="#9BF1CD" stroke="#252B3A" strokeWidth="4" />
            </svg>
            <div className="dp-hero-window" aria-hidden="true">
              <div className="flex min-h-12 items-center justify-between gap-2 border-b-2 border-border px-3 sm:px-4">
                <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-foreground bg-[var(--dp-color-accent-warm)] text-foreground"><Inbox className="h-3.5 w-3.5" /></span><span className="text-xs font-bold sm:text-sm">OtpWave workspace</span></div>
                <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] font-medium">Workspace preview</span>
              </div>
              <div className="grid min-h-[150px] grid-cols-[102px_minmax(0,1fr)] sm:min-h-[190px] sm:grid-cols-[132px_minmax(0,1fr)]">
                <div className="border-r-2 border-border bg-[var(--dp-color-field-soft)] p-2.5 sm:p-3">
                  <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground sm:pb-3">Workspace</p>
                  <div className="space-y-1.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                    <div className="flex items-center gap-1.5 rounded-lg border border-foreground bg-[var(--dp-color-selection)] px-2 py-1.5 text-foreground"><Inbox className="h-3 w-3 shrink-0" /> Inbox</div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5"><Smartphone className="h-3 w-3 shrink-0" /> WhatsApp</div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5"><KeyRound className="h-3 w-3 shrink-0" /> API keys</div>
                    <div className="hidden items-center gap-1.5 px-2 py-1.5 sm:flex"><Webhook className="h-3 w-3 shrink-0" /> Webhooks</div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2 sm:px-4"><div><p className="text-xs font-bold sm:text-sm">Inbox</p><p className="mt-0.5 text-[10px] text-muted-foreground">Your conversations, in one place</p></div><span className="whitespace-nowrap rounded-lg border border-border px-2 py-1 text-[10px]">All chats</span></div>
                  <div className="grid flex-1 place-items-center px-2 py-4 text-center sm:py-6">
                    <div><span className="mx-auto grid h-8 w-8 place-items-center rounded-xl border-2 border-foreground bg-[var(--dp-color-accent-fresh)] text-foreground sm:h-9 sm:w-9"><Inbox aria-hidden="true" className="h-4 w-4" /></span><p className="mt-2 text-[10px] font-semibold sm:mt-3 sm:text-xs">Your conversations appear here</p><p className="mt-1 text-[10px] text-muted-foreground">Connect WhatsApp to get started.</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dp-facts relative z-10 mx-auto mt-2 grid w-full max-w-[780px] grid-cols-1 gap-2 rounded-[20px] border-[3px] border-foreground bg-card px-4 py-3 shadow-[6px_6px_0_var(--dp-color-accent-fresh)] sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-4 lg:col-span-2 lg:mt-1">
            <span className="inline-flex items-center gap-2.5 text-sm font-semibold"><Check aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" /> Your own WhatsApp account</span>
            <span className="inline-flex items-center gap-2.5 text-sm font-semibold"><Check aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" /> API and MCP access</span>
          </div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-20 bg-background px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="dp-book-wrap mx-auto max-w-[1240px]">
          <div aria-hidden="true" className="dp-book-backdrop" />
          <div className="dp-book">
            <span aria-hidden="true" className="dp-book-tab" />
            <div className="grid gap-5 border-b-2 border-border pb-8 pt-2 sm:gap-8 md:grid-cols-[.9fr_1.1fr] md:items-end md:pb-10">
              <div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">One connected workspace</p><h2 className="mt-4 max-w-[13ch] text-[clamp(2.55rem,5.5vw,4.5rem)] leading-[.96]">Made for the conversation and what follows.</h2></div>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">Keep day-to-day messaging close to the API, delivery records, and account settings that power it. Move between tools without losing the thread.</p>
            </div>
            <div id="workflows" className="scroll-mt-24 grid divide-y-2 divide-border md:grid-cols-2 md:divide-y-0 md:gap-x-8">
              {capabilities.map(({ n, title, text, href, action, icon: Icon }) => (
                <article key={n} className="grid gap-3 border-border py-6 sm:grid-cols-[48px_1fr] sm:gap-4 sm:border-b-2 sm:py-7">
                  <span className="font-mono text-sm font-bold text-primary">{n}</span>
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="dp-feature-icon"><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></span>
                    <div><h3 className="font-display text-xl font-bold leading-tight sm:text-2xl">{title}</h3><p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{text}</p><Link href={href} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary transition-colors hover:text-foreground">{action}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-8 rounded-[30px] border-[3px] border-foreground bg-[var(--dp-color-field-soft)] p-5 shadow-[8px_8px_0_var(--dp-color-accent-warm)] sm:p-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:gap-10 lg:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">For developers</p>
            <h2 className="mt-4 max-w-[12ch] text-[clamp(2.5rem,5vw,4.15rem)] leading-[.96]">A direct path from request to delivery.</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">Create an API key, send one request from your server, and inspect delivery activity from the workspace.</p>
            <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3" aria-label="API workflow">
              <div className="dp-process-step flex items-center gap-3 md:block"><span className="dp-process-number shrink-0">01</span><p className="text-sm font-semibold leading-5 md:mt-3">Create an API key</p></div>
              <div className="dp-process-step flex items-center gap-3 md:block"><span className="dp-process-number shrink-0">02</span><p className="text-sm font-semibold leading-5 md:mt-3">Send one request</p></div>
              <div className="dp-process-step flex items-center gap-3 md:block"><span className="dp-process-number shrink-0">03</span><p className="text-sm font-semibold leading-5 md:mt-3">Inspect delivery activity</p></div>
            </div>
            <Link href="/docs" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:text-foreground">Read the API docs <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
          <div className="dp-code-surface overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-white/20 px-4 py-3 sm:px-5"><div className="flex items-center gap-2 text-sm font-semibold"><Code2 aria-hidden="true" className="h-4 w-4 text-[var(--dp-color-accent-warm)]" /> Send a verification code</div><span className="rounded-lg border border-white/50 px-2 py-0.5 font-mono text-xs font-bold">POST</span></div>
            <pre className="overflow-x-auto p-4 text-xs leading-6 text-[#fffdf5] sm:p-6 sm:text-sm"><code>{curlExample}</code></pre>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-white/20 px-4 py-3 text-xs text-white sm:px-5"><span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--dp-color-accent-fresh)]" /> API key authentication</span><span className="inline-flex items-center gap-1.5"><Webhook aria-hidden="true" className="h-4 w-4 text-[var(--dp-color-accent-secondary)]" /> Delivery webhooks</span></div>
          </div>
        </div>
      </section>

      <section className="dp-back-cover relative mt-14 overflow-hidden px-5 pb-0 pt-14 sm:px-8 sm:pt-20 lg:px-12">
        <svg aria-hidden="true" className="dp-cover-confetti pointer-events-none absolute right-4 top-3 h-32 w-40 sm:right-10 sm:top-8" viewBox="0 0 160 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="26" cy="28" r="13" fill="#FFD05B" stroke="#252B3A" strokeWidth="3" />
          <path d="M112 13L129 44H95L112 13Z" fill="#FF78C5" stroke="#252B3A" strokeWidth="3" />
          <rect x="39" y="73" width="23" height="23" rx="5" fill="#6434DF" stroke="#252B3A" strokeWidth="3" />
        </svg>
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 pb-12 sm:flex-row sm:items-center sm:justify-between sm:pb-16">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-foreground">Start with your workspace</p><h2 className="mt-3 max-w-[15ch] text-3xl leading-tight sm:text-4xl">Keep every message moving.</h2><p className="mt-3 max-w-xl text-base leading-7 text-foreground/80">Connect WhatsApp, explore the inbox, and bring your delivery tools into one place.</p></div>
          <Button asChild size="lg" className="h-12 shrink-0 px-6"><Link href="/signup">Create your account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>
        </div>
        <footer className="dp-footer mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-5 pb-6 pt-7 text-sm sm:grid-cols-2 sm:items-center sm:px-8 lg:grid-cols-3 lg:px-10">
          <Brand className="text-[var(--dp-color-ground)]" markClassName="h-7 w-7 text-[var(--dp-color-accent-warm)]" />
          <p className="text-[13px] text-white/80">WhatsApp messaging and OTP operations.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-white lg:justify-end"><Link href="/docs" className="hover:text-[var(--dp-color-accent-warm)]">Documentation</Link><Link href="/docs#mcp" className="hover:text-[var(--dp-color-accent-warm)]">MCP setup</Link><Link href="https://github.com/mohammadalibalwe48-hub/Whatsappppp" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--dp-color-accent-warm)]">GitHub</Link></nav>
        </footer>
      </section>
    </main>
  );
}
