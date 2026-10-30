"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LogOut, Menu, MessageSquare, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNavigation, dashboardNavItems } from "@/components/dashboard/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  email: string | null;
  isAdmin?: boolean;
}

export function DashboardTopbar({ email, isAdmin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState("");
  const currentPage = [...dashboardNavItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const launcherItems = dashboardNavItems
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => `${item.label} ${item.href} ${item.group}`.toLowerCase().includes(launcherQuery.trim().toLowerCase()));

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLauncherOpen(true);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function navigateTo(href: string) {
    router.push(href);
    setLauncherOpen(false);
    setLauncherQuery("");
  }

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
          <DialogContent aria-describedby={undefined} className="left-0 top-0 h-dvh w-[min(88vw,340px)] max-w-none -translate-x-0 -translate-y-0 gap-0 rounded-none border-y-0 border-l-0 border-[#2a2522] bg-[#100e0d] p-0 text-[#f3eeeb] data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:max-w-none">
            <div className="flex h-full flex-col bg-[#100e0d]">
              <DialogHeader className="flex h-[76px] justify-center border-b border-[#2a2522] px-6 pr-12">
                <DialogTitle asChild>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                      <MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    OtpWave
                  </Link>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-3 py-5">
                <DashboardNavigation isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="border-t border-[#2a2522] px-6 py-4 text-xs text-[#a39a95]">
                Signed in as <span className="font-medium text-white">{email ?? "your account"}</span>
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
        <Dialog open={launcherOpen} onOpenChange={(open) => { setLauncherOpen(open); if (!open) setLauncherQuery(""); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 px-2 sm:px-3" aria-label="Search dashboard pages">
              <Search aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Go to</span>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground lg:inline">⌘ K</kbd>
            </Button>
          </DialogTrigger>
          <DialogContent className="top-[18vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[18vh]">
            <DialogHeader className="border-b border-border px-4 py-4 pr-12">
              <DialogTitle>Go to a page</DialogTitle>
              <DialogDescription>Search your workspace and developer tools.</DialogDescription>
            </DialogHeader>
            <div className="relative border-b border-border px-4 py-3">
              <Search aria-hidden="true" className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={launcherQuery} onChange={(event) => setLauncherQuery(event.target.value)} placeholder="Search pages…" className="border-0 pl-9 shadow-none focus-visible:ring-0" aria-label="Search dashboard pages" />
            </div>
            <div className="max-h-[min(55vh,420px)] overflow-y-auto p-2">
              {launcherItems.length ? launcherItems.map(({ href, label, group, icon: Icon }) => (
                <button key={href} type="button" onClick={() => navigateTo(href)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1 font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{group}</span>
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">No pages match “{launcherQuery}”.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground"><span>Navigate to any dashboard page</span><span><kbd className="rounded border border-border bg-card px-1.5 py-0.5">Esc</kbd> to close</span></div>
          </DialogContent>
        </Dialog>
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
