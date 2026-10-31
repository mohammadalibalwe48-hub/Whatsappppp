"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GlassOrbCluster } from "@/components/glass-orb-cluster";
import { Brand } from "@/components/brand";
import { AnimatedGridPattern } from "@/components/magic-ui/animated-grid-pattern";
import { BlurFade } from "@/components/magic-ui/blur-fade";
import { MagicCard } from "@/components/magic-ui/magic-card";

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/dashboard` }
      });
      if (error) throw error;
      toast.success("Check your email to continue.");
      router.replace(search.get("redirect") ?? "/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-muted-foreground">Email address</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-muted/30 focus-visible:ring-primary/30"
          placeholder="name@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-muted-foreground">Choose a password</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-muted/30 focus-visible:ring-primary/30"
          placeholder="At least 6 characters"
        />
      </div>
      <Button type="submit" className="w-full h-11 text-base group mt-2" disabled={loading}>
        {loading ? "Creating account…" : (
          <>
            Create account <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0c0b0a] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <AnimatedGridPattern className="text-primary/25 [mask-image:linear-gradient(to_bottom_right,black,transparent_75%)]" squareCount={28} />
        <div aria-hidden="true" className="halftone-band absolute left-0 top-[63%] h-16 w-full opacity-50" />
        <GlassOrbCluster className="absolute -right-24 top-[14%] h-[440px] w-[440px] opacity-55" />
        <Brand className="relative text-white" markClassName="h-9 w-9 text-white" />
        <BlurFade className="relative z-10 max-w-xl py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">One account, every tool</p>
          <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Make WhatsApp work for your team.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#b7ada7]">Connect your own account, work through conversations, and send verification codes from your app.</p>
          <ul className="mt-8 space-y-3 text-sm text-[#d9d0ca]"><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Live chats, replies, and media</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> OTP keys, logs, and webhooks</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> OAuth access for AI clients</li></ul>
        </BlurFade>
        <p className="relative text-xs text-[#8d837d]">OtpWave · WhatsApp messaging and OTP tools</p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-20">
        <Brand className="mb-10 lg:hidden" />
        <div className="mx-auto w-full max-w-md animate-fade-in">
          <div className="mb-7">
            <p className="text-sm font-medium text-primary">Get started</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign up to connect WhatsApp and open your workspace.</p>
          </div>

          <MagicCard className="rounded-2xl">
          <Card className="border-border shadow-sm">
            <CardContent className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
            <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Loading form…</div>}>
              <SignupForm />
            </Suspense>
          </CardContent>
        </Card>
          </MagicCard>
      </div>
      </section>
    </main>
  );
}
