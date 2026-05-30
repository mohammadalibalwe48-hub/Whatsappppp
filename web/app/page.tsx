import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquare, Shield, Zap, Code2, Globe, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 right-0 h-[500px] w-full bg-gradient-to-b from-primary/10 via-background to-background -z-10 blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <header className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between py-6 relative z-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-2xl tracking-tight transition-transform hover:scale-105">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-green-600 text-white shadow-lg shadow-primary/20">
            <MessageSquare className="h-5 w-5" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">OtpWave</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Log in
          </Link>
          <Button asChild size="sm" className="rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Link href="/signup">
              Get Started
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-10 py-20 md:py-32 text-center flex-grow relative z-10">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm font-medium transition-all hover:bg-primary/10 cursor-default backdrop-blur-sm animate-fade-in">
          <span className="flex h-2.5 w-2.5 rounded-full bg-primary mr-3 animate-pulse"></span>
          <span className="text-primary font-semibold">Now built on Baileys, Supabase & Redis</span>
        </div>

        <div className="max-w-5xl space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl lg:text-8xl text-balance">
            <span className="block">Add WhatsApp OTPs</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-500 to-emerald-400 pb-2">
              to your app
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-muted-foreground md:text-xl text-balance mt-6 leading-relaxed">
            Connect your own WhatsApp account, generate an API key, and start sending OTPs instantly.
            No SMS contracts. No third-party gateways. Just clean, lightning-fast delivery.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
          <Button asChild size="lg" className="w-full sm:w-auto rounded-full h-14 px-10 text-lg font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all group">
            <Link href="/signup">
              Start Building <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full h-14 px-10 text-lg font-medium border-2 hover:bg-accent hover:text-accent-foreground transition-all">
            <Link href="/docs">View Documentation</Link>
          </Button>
        </div>

        {/* Code Mockup */}
        <div className="w-full max-w-4xl mt-16 rounded-2xl overflow-hidden border border-border/50 bg-card shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="flex items-center px-4 py-3 bg-muted/50 border-b border-border/50">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="mx-auto text-xs font-mono text-muted-foreground">send-otp.js</div>
          </div>
          <div className="p-6 text-left overflow-x-auto">
            <pre className="font-mono text-sm leading-relaxed">
              <code className="text-foreground">
                <span className="text-primary">const</span> response = <span className="text-primary">await</span> fetch(<span className="text-green-400">'https://api.otpwave.com/v1/send'</span>, {"{"}
                {"\n"}  method: <span className="text-green-400">'POST'</span>,
                {"\n"}  headers: {"{"}
                {"\n"}    <span className="text-green-400">'Authorization'</span>: <span className="text-green-400">'Bearer sk_live_...'</span>,
                {"\n"}    <span className="text-green-400">'Content-Type'</span>: <span className="text-green-400">'application/json'</span>
                {"\n"}  {"}"},
                {"\n"}  body: JSON.<span className="text-blue-400">stringify</span>({"{"}
                {"\n"}    to: <span className="text-green-400">'+1234567890'</span>,
                {"\n"}    channel: <span className="text-green-400">'whatsapp'</span>
                {"\n"}  {"}"})
                {"\n"}{"}"});
                {"\n\n"}<span className="text-primary">const</span> data = <span className="text-primary">await</span> response.<span className="text-blue-400">json</span>();
                {"\n"}<span className="text-muted-foreground">{"// { status: 'pending', id: 'otp_123...' }"}</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything you need to verify users</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Powerful infrastructure disguised as a simple API. Built for modern development teams.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Zap className="h-7 w-7" />}
            title="Fast integration"
            body="A clean REST API with copy-paste examples. Send and verify OTPs with just a few lines of code in any language."
          />
          <Feature
            icon={<Shield className="h-7 w-7" />}
            title="Secure by default"
            body="OTP hashing, per-key rate limiting, HMAC-signed webhooks, and full RLS isolation per tenant on Supabase."
          />
          <Feature
            icon={<Smartphone className="h-7 w-7" />}
            title="Your own WhatsApp"
            body="Use your own connected WhatsApp account. Stable multi-device sessions that survive server restarts."
          />
          <Feature
            icon={<Code2 className="h-7 w-7" />}
            title="Developer First"
            body="Comprehensive documentation, clear error messages, and a dashboard built specifically for developers."
          />
          <Feature
            icon={<Globe className="h-7 w-7" />}
            title="Global Reach"
            body="Deliver OTPs anywhere in the world instantly over WhatsApp, bypassing unreliable local SMS networks."
          />
          <Feature
            icon={<Lock className="h-7 w-7" />}
            title="No lock-in"
            body="Because you use your own WhatsApp number, you own the channel. No platform lock-in or hidden fees."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 my-10 relative z-10">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2" />

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Ready to ditch SMS?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join developers who are using OtpWave to deliver reliable, fast, and secure OTPs via WhatsApp.
          </p>
          <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg font-semibold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all group">
            <Link href="/signup">
              Get Started for Free <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20 py-12 mt-auto relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight opacity-80 hover:opacity-100 transition-opacity">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>OtpWave</span>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} OtpWave. All rights reserved.
          </p>
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
    <div className="group flex flex-col items-start text-left p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none">
        {icon}
      </div>
      <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-3 text-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-base text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
