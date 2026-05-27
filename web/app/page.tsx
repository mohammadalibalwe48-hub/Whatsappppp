import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <header className="container mx-auto px-4 flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span>OtpWave</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block">
            Log in
          </Link>
          <Button asChild size="sm" className="rounded-full px-6">
            <Link href="/signup">
              Get Started
            </Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto px-4 flex flex-col items-center gap-8 py-16 md:py-32 text-center flex-grow">
        <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 cursor-default">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
          Now built on Baileys, Supabase & Redis
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl lg:text-8xl text-balance">
          Add WhatsApp OTPs to your app
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl text-balance mt-2">
          Connect your own WhatsApp account, generate an API key, and start sending OTPs.
          No SMS contracts. No third-party gateways. Just clean, reliable delivery.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
          <Button asChild size="lg" className="w-full sm:w-auto rounded-full h-12 px-8 text-base font-medium">
            <Link href="/signup">
              Start Building <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full h-12 px-8 text-base font-medium">
            <Link href="/docs">View Documentation</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24 border-t border-border/40">
        <div className="grid gap-8 md:grid-cols-3">
          <Feature
            icon={<Zap className="h-6 w-6" />}
            title="Fast integration"
            body="A clean REST API with copy-paste examples. Send and verify OTPs with just a few lines of code."
          />
          <Feature
            icon={<Shield className="h-6 w-6" />}
            title="Secure by default"
            body="OTP hashing, per-key rate limiting, HMAC-signed webhooks, and full RLS isolation per tenant."
          />
          <Feature
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Your own WhatsApp"
            body="Use your own connected WhatsApp account. Stable multi-device sessions that survive restarts."
          />
        </div>
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
    <div className="flex flex-col items-start text-left p-6 sm:p-8 rounded-3xl bg-muted/30 border border-border/50 hover:border-border/80 transition-colors">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
      <p className="text-base text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
