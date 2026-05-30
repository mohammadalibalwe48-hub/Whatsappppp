"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MessageSquare, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) throw error;
      toast.success("Account created — check your inbox if email confirmation is required");
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-8 py-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 relative z-10 min-h-[calc(100vh-2rem)] lg:min-h-0">

        {/* Left Column - Marketing / Info */}
        <div className="w-full max-w-md lg:max-w-lg flex flex-col text-center lg:text-left">
          <div className="mb-8 hidden lg:block">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>

          <Link href="/" className="inline-flex items-center justify-center lg:justify-start gap-3 transition-transform hover:scale-105 origin-left mb-8">
            <div className="grid h-10 w-10 lg:h-12 lg:w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-green-600 text-white shadow-lg shadow-primary/20">
              <MessageSquare className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <span className="text-2xl lg:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              OtpWave
            </span>
          </Link>

          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Start verifying users with WhatsApp today.
          </h1>
          <p className="text-muted-foreground text-lg mb-8 lg:mb-10">
            Join developers building secure, fast, and reliable authentication flows without the hassle of SMS gateways.
          </p>

          <div className="hidden lg:flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-1 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-base text-foreground/80">Connect your own WhatsApp account</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-1 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-base text-foreground/80">No per-message markup fees</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-1 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-base text-foreground/80">Global reach without local carrier filtering</span>
            </div>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="w-full max-w-md">
          <Card className="w-full border-border/40 shadow-2xl shadow-black/5 rounded-3xl bg-card/60 backdrop-blur-xl">
            <CardHeader className="space-y-2 pb-6 px-6 sm:px-8 pt-8">
              <CardTitle className="text-2xl font-bold tracking-tight">Create your account</CardTitle>
              <CardDescription className="text-base">
                Enter your details to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground/80">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 bg-background/50 border-border/50 focus-visible:ring-primary/50"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-background/50 border-border/50 focus-visible:ring-primary/50"
                    placeholder="jane@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground/80">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-background/50 border-border/50 focus-visible:ring-primary/50"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <Button type="submit" className="w-full h-11 mt-2 text-base font-semibold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all" disabled={loading}>
                  {loading ? "Creating account…" : "Create account"}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <p className="text-center text-sm text-muted-foreground pt-2">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary font-medium hover:underline transition-colors">
                    Sign in here
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-8 px-4">
            By clicking "Create account", you agree to our <Link href="#" className="hover:text-foreground underline underline-offset-2">Terms of Service</Link> and <Link href="#" className="hover:text-foreground underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
