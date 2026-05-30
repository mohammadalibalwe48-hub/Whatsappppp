import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Shield, Zap, Terminal, Code2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      {/* Sticky Header with Glassmorphism */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight transition-transform hover:scale-105">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span>OtpWave</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Log in
            </Link>
            <Button asChild size="sm" className="rounded-full px-6 shadow-sm shadow-primary/20 hover:shadow-primary/40 transition-shadow">
              <Link href="/signup">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden container mx-auto px-4 flex flex-col items-center justify-center gap-8 py-20 md:py-32 lg:py-40 text-center flex-grow">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10 cursor-default animate-fade-in">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
          Now built on Baileys, Supabase & Redis
        </div>

        <h1 className="max-w-5xl text-5xl font-extrabold tracking-tight md:text-7xl lg:text-8xl text-balance animate-fade-in [animation-delay:100ms] opacity-0 fill-mode-forwards">
          Add WhatsApp OTPs to your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">modern app</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl text-balance mt-4 animate-fade-in [animation-delay:200ms] opacity-0 fill-mode-forwards leading-relaxed">
          Connect your own WhatsApp account, generate an API key, and start sending OTPs.
          No SMS contracts. No third-party gateways. Just clean, reliable delivery.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto animate-fade-in [animation-delay:300ms] opacity-0 fill-mode-forwards">
          <Button asChild size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all group">
            <Link href="/signup">
              Start Building <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full h-14 px-8 text-base font-semibold border-border/50 hover:bg-muted/50 transition-colors">
            <Link href="/docs">
              <Terminal className="mr-2 h-5 w-5" /> View Docs
            </Link>
          </Button>
        </div>
      </section>

      {/* Code Snippet Showcase Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto rounded-3xl border border-border/50 bg-muted/20 overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="flex items-center px-4 py-3 border-b border-border/50 bg-muted/40">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="mx-auto flex items-center text-xs text-muted-foreground font-mono">
              <Code2 className="w-3 h-3 mr-2" />
              send-otp.sh
            </div>
          </div>
          <div className="p-6 md:p-8 overflow-x-auto text-sm md:text-base font-mono leading-relaxed text-left">
            <pre>
              <code className="text-muted-foreground">
                <span className="text-emerald-400">curl</span> -X POST https://api.otpwave.com/v1/otp/send \<br/>
                {'  '}-H <span className="text-yellow-300">"Authorization: Bearer ow_live_..."</span> \<br/>
                {'  '}-H <span className="text-yellow-300">"Content-Type: application/json"</span> \<br/>
                {'  '}-d <span className="text-primary/80">'{'{'}"phone": "+1234567890", "app": "MyApp"{'}'}'</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 border-t border-border/40 bg-gradient-to-b from-background to-muted/20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to ship</h2>
          <p className="mt-4 text-lg text-muted-foreground">Built for developers who want simplicity and speed.</p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-3 max-w-6xl mx-auto">
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

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-muted-foreground">
             <MessageSquare className="h-5 w-5" />
             <span>OtpWave</span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} OtpWave. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
             <Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
             <Link href="https://github.com/mohammadalibalwe48-hub/Whatsappppp" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Globe className="h-4 w-4"/> GitHub
             </Link>
          </div>
        </div>
      </footer>
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
    <div className="group flex flex-col items-start text-left p-6 sm:p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
      <p className="text-base text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
