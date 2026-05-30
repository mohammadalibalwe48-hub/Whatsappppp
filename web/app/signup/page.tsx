"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />

      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 font-bold text-xl tracking-tight transition-transform hover:scale-105">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <MessageSquare className="h-4 w-4" />
        </div>
        <span>OtpWave</span>
      </Link>

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Get started</h1>
          <p className="text-muted-foreground mt-2">Create a new OtpWave account.</p>
        </div>

        <Card className="border-border/40 shadow-2xl shadow-black/10 backdrop-blur-sm bg-card/80">
          <CardContent className="pt-8">
            <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Loading form…</div>}>
              <SignupForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
