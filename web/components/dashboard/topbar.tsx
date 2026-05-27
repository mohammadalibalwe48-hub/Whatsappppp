"use client";

import { useState } from "react";
import { LogOut, Menu, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DashboardNavItems } from "@/components/dashboard/sidebar";

interface Props {
  email: string | null;
  isAdmin?: boolean;
}

export function DashboardTopbar({ email, isAdmin = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 border-r border-border/60 bg-card/40">
            <div className="flex flex-col h-full">
              <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5 font-semibold">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span>OtpWave</span>
              </div>
              <nav className="flex-1 overflow-auto px-3 py-4">
                <DashboardNavItems isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
              </nav>
              <div className="border-t border-border/60 p-4 text-xs text-muted-foreground">
                Powered by Baileys · Supabase · Redis
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="text-sm text-muted-foreground hidden sm:block">{email}</div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
