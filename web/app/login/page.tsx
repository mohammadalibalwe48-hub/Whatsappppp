"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MessageSquare, ArrowLeft } from "lucide-react";

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
        <Label htmlFor="email" className="text-foreground/80">Email address</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 bg-background/50 border-border/50 focus-visible:ring-primary/50"
          placeholder="name@example.com"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-foreground/80">Password</Label>
          <Link href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-background/50 border-border/50 focus-visible:ring-primary/50"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all" disabled={loading}>
        {loading ? "Signing in…" : "Sign in to OtpWave"}
      </Button>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">New to OtpWave?</span>
        </div>
      </div>
      <Button asChild variant="outline" className="w-full h-11 border-border/50 hover:bg-muted/50 transition-colors">
        <Link href="/signup">Create an account</Link>
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="w-full max-w-md absolute top-8 left-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>

      <div className="mb-8 flex flex-col items-center justify-center space-y-4">
        <Link href="/" className="flex items-center justify-center transition-transform hover:scale-105">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-green-600 text-white shadow-lg shadow-primary/20">
            <MessageSquare className="h-6 w-6" />
          </div>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-center">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Sign in to your account to manage your WhatsApp OTP verification settings.
        </p>
      </div>

      <Card className="w-full max-w-md border-border/40 shadow-xl shadow-black/5 rounded-3xl bg-card/50 backdrop-blur-xl relative z-10">
        <CardContent className="pt-8 px-6 sm:px-8 pb-8">
          <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Loading form…</div>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
