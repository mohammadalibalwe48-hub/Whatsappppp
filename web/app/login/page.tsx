"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, ArrowRight, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GlassOrbCluster } from "@/components/glass-orb-cluster";

function LoginForm() {
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
      router.replace(search.get("redirect") ?? "/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign in");
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-muted-foreground">Password</Label>
        </div>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-muted/30 focus-visible:ring-primary/30"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full h-11 text-base group mt-2" disabled={loading}>
        {loading ? "Signing in…" : (
          <>
            Sign in <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Don't have an account?{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline underline-offset-4">
          Create one now
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0b0a09] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div aria-hidden="true" className="halftone-band absolute left-0 top-[63%] h-16 w-full opacity-50" />
        <GlassOrbCluster className="absolute -right-24 top-[14%] h-[440px] w-[440px] opacity-55" />
        <Link href="/" className="relative flex w-fit items-center gap-3 font-semibold tracking-tight focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageSquare aria-hidden="true" className="h-5 w-5" /></span><span className="text-xl">OtpWave</span>
        </Link>
        <div className="relative max-w-xl py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your messaging workspace</p>
          <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Stay close to every conversation.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#b7ada7]">Connect WhatsApp, manage chats, and keep your verification API moving from one place.</p>
          <ul className="mt-8 space-y-3 text-sm text-[#d9d0ca]"><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Read and reply in your live inbox</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Send OTPs through a simple API</li><li className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-primary" /> Connect AI tools through OAuth</li></ul>
        </div>
        <p className="relative text-xs text-[#8d837d]">OtpWave · WhatsApp messaging and OTP tools</p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-20">
        <Link href="/" className="mb-10 flex w-fit items-center gap-2.5 font-semibold tracking-tight lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" /></span><span className="text-lg">OtpWave</span></Link>
        <div className="mx-auto w-full max-w-md animate-fade-in">
          <div className="mb-7">
            <p className="text-sm font-medium text-primary">Welcome back</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to OtpWave</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use your account email and password to open your workspace.</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
            <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Loading form…</div>}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
      </section>
    </main>
  );
}
