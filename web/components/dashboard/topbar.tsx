"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNavigation, dashboardNavItems } from "@/components/dashboard/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  email: string | null;
  isAdmin?: boolean;
}

export function DashboardTopbar({ email, isAdmin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = [...dashboardNavItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open dashboard menu">
              <Menu aria-hidden="true" className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh w-[min(88vw,340px)] max-w-none -translate-x-0 -translate-y-0 gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:max-w-none">
            <div className="flex h-full flex-col bg-card">
              <DialogHeader className="flex h-[72px] justify-center border-b border-border px-6 pr-12">
                <DialogTitle asChild>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    OtpWave
                  </Link>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-3 py-5">
                <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">Workspace</p>
                <DashboardNavigation isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{email ?? "your account"}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{currentPage?.label ?? "Workspace"}</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">OtpWave workspace</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="hidden max-w-[240px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex">
          <User aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{email ?? "Account"}</span>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="sm:hidden">
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:inline-flex">
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
