import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[40rem] w-[80rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span>OtpWave</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/signup">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          Built on Baileys · Supabase · Redis
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          WhatsApp OTP verification for modern apps.
        </h1>
        <p className="max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          Connect your own WhatsApp account, generate an API key, and start sending OTPs in under
          five minutes. No SMS contracts. No third-party gateways.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/signup">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        <Feature
          icon={<Zap className="h-5 w-5" />}
          title="Five-minute integration"
          body="A clean REST API with copy-paste examples. Send and verify OTPs with three lines of code."
        />
        <Feature
          icon={<Shield className="h-5 w-5" />}
          title="Secure by default"
          body="OTP hashing, per-key rate limiting, HMAC-signed webhooks, and full RLS isolation per tenant."
        />
        <Feature
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Your WhatsApp, your reach"
          body="Use your own connected WhatsApp account. Stable multi-device sessions that survive restarts."
        />
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="glow-card relative rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur transition-colors">
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
