"use client";

import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  email: string | null;
}

export function DashboardTopbar({ email }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl md:px-8 shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/80 bg-muted/30 py-1.5 px-3 rounded-full border border-border/40">
        <User className="w-4 h-4" />
        <span className="hidden sm:inline-block">{email}</span>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </header>
  );
}
