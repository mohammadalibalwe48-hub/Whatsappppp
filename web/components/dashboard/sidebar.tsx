"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Bot,
  Cable,
  Home,
  Inbox,
  MoreHorizontal,
  KeyRound,
  ListChecks,
  Play,
  Settings,
  Shield,
  Webhook
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  group: "Workspace" | "Developer tools" | "Account";
}

export const dashboardNavItems: NavItem[] = [
  { group: "Workspace", href: "/dashboard", label: "Overview", icon: Home },
  { group: "Workspace", href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { group: "Workspace", href: "/dashboard/whatsapp", label: "WhatsApp", icon: Cable },
  { group: "Workspace", href: "/dashboard/analytics", label: "Analytics", icon: Activity },
  { group: "Workspace", href: "/dashboard/assistant", label: "AI assistant", icon: Bot },
  { group: "Developer tools", href: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
  { group: "Developer tools", href: "/dashboard/playground", label: "API playground", icon: Play },
  { group: "Developer tools", href: "/dashboard/logs", label: "OTP logs", icon: ListChecks },
  { group: "Developer tools", href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { group: "Developer tools", href: "/dashboard/docs", label: "Docs & MCP", icon: BookOpen },
  { group: "Account", href: "/dashboard/settings", label: "Settings", icon: Settings },
  { group: "Account", href: "/dashboard/admin", label: "Admin", icon: Shield, adminOnly: true }
];

export function DashboardNavigation({
  isAdmin = false,
  onNavigate,
  className
}: {
  isAdmin?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const visibleItems = dashboardNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav aria-label="Dashboard" className={className}>
      {(["Workspace", "Developer tools", "Account"] as const).map((group) => (
        <div key={group} className="mb-6 last:mb-0">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#827975]">{group}</p>
          <ul className="space-y-1.5">
            {visibleItems.filter((item) => item.group === group).map(({ href, label, icon: Icon }) => {
              const active = href === "/dashboard"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      active
                        ? "bg-primary/[0.13] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/.17)]"
                        : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground"
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("h-[17px] w-[17px] shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/75 group-hover:text-foreground/80")} />
                    <span>{label}</span>
                    {active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/.75)]" />}
                    {active && <span className="sr-only">Current page</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DashboardSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <aside className="workspace-backdrop sticky top-0 hidden h-dvh w-[256px] shrink-0 border-r border-border/80 bg-card/85 text-foreground lg:flex lg:flex-col">
      <div className="flex h-[76px] items-center border-b border-border/70 px-5">
        <Brand href="/dashboard" className="text-foreground" markClassName="h-8 w-8 text-primary" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6">
        <DashboardNavigation isAdmin={isAdmin} />
      </div>

      <div className="m-3 rounded-2xl border border-border/80 bg-background/75 p-4 surface-inset">
        <div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgb(52_211_153/.7)]" /><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Developer workspace</p></div>
        <p className="text-sm font-semibold text-foreground">Build on OtpWave</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Guides, API tools, and examples in one place.</p>
        <Link href="/dashboard/docs" className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80">
          <BookOpen aria-hidden="true" className="h-4 w-4" /> Open documentation
        </Link>
      </div>
    </aside>
  );
}

export function DashboardMobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primaryHrefs = ["/dashboard", "/dashboard/inbox", "/dashboard/whatsapp", "/dashboard/assistant"];
  const primaryItems = dashboardNavItems.filter((item) => primaryHrefs.includes(item.href));
  const visibleItems = dashboardNavItems.filter((item) => !item.adminOnly || isAdmin);
  const isPrimaryPath = primaryItems.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <nav aria-label="Primary workspace" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-2 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] text-muted-foreground shadow-[0_-10px_32px_rgba(0,0,0,.24)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            const shortLabel = href === "/dashboard/assistant" ? "AI" : label;
            return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors", active ? "bg-primary/[0.09] text-primary" : "hover:text-foreground")}><Icon aria-hidden="true" className="h-[18px] w-[18px]" /><span>{shortLabel}</span></Link></li>;
          })}
          <li>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><button type="button" aria-label="More workspace pages" aria-expanded={open} className={cn("flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors", !isPrimaryPath ? "bg-primary/[0.09] text-primary" : "hover:text-foreground")}><MoreHorizontal aria-hidden="true" className="h-[18px] w-[18px]" /><span>More</span></button></DialogTrigger>
              <DialogContent className="bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 right-2 top-auto max-h-[min(75dvh,620px)] w-auto max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground sm:left-1/2 sm:right-auto sm:w-[440px] sm:-translate-x-1/2">
                <DialogHeader className="border-b border-border px-4 py-4 pr-12 text-left"><DialogTitle>Workspace</DialogTitle><DialogDescription>Open a tool or account setting.</DialogDescription></DialogHeader>
                <div className="overflow-y-auto p-2">
                  {(["Workspace", "Developer tools", "Account"] as const).map((group) => (
                    <section key={group} className="py-2">
                      <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{group}</h2>
                      <div className="grid grid-cols-2 gap-1">
                        {visibleItems.filter((item) => item.group === group && !primaryItems.some((primary) => primary.href === item.href)).map(({ href, label, icon: Icon }) => {
                          const active = pathname === href || pathname.startsWith(`${href}/`);
                          return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm", active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted")}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></Link>;
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </li>
        </ul>
      </nav>
    </>
  );
}
