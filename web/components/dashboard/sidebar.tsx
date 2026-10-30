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
          <ul className="space-y-1">
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
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      active
                        ? "bg-primary/15 text-white shadow-sm shadow-black/10"
                        : "text-[#c3bbb6] hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-[#8e8580] group-hover:text-[#d8cfca]")} />
                    <span>{label}</span>
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
    <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 border-r border-[#2a2522] bg-[#100e0d] text-[#f3eeeb] lg:flex lg:flex-col">
      <div className="flex h-[76px] items-center border-b border-[#2a2522] px-5">
        <Brand href="/dashboard" className="text-white" markClassName="h-8 w-8 text-white" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <DashboardNavigation isAdmin={isAdmin} />
      </div>

      <div className="m-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <p className="text-sm font-semibold text-white">Building an integration?</p>
        <p className="mt-1 text-xs leading-5 text-[#a39a95]">Find examples and connect your AI tools.</p>
        <Link href="/dashboard/docs" className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary">
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
      <nav aria-label="Primary workspace" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#11100f]/95 px-2 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] text-[#bfb6b1] shadow-[0_-10px_32px_rgba(0,0,0,.28)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {primaryItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            const shortLabel = href === "/dashboard/assistant" ? "AI" : label;
            return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium", active ? "text-primary" : "hover:text-white")}><Icon aria-hidden="true" className="h-[18px] w-[18px]" /><span>{shortLabel}</span></Link></li>;
          })}
          <li>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><button type="button" aria-label="More workspace pages" aria-expanded={open} className={cn("flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium", !isPrimaryPath ? "text-primary" : "hover:text-white")}><MoreHorizontal aria-hidden="true" className="h-[18px] w-[18px]" /><span>More</span></button></DialogTrigger>
              <DialogContent className="bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-2 right-2 top-auto max-h-[min(75dvh,620px)] w-auto max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#151311] p-0 text-white sm:left-1/2 sm:right-auto sm:w-[440px] sm:-translate-x-1/2">
                <DialogHeader className="border-b border-white/10 px-4 py-4 pr-12 text-left"><DialogTitle>Workspace</DialogTitle><DialogDescription className="text-[#a99f99]">Open a tool or account setting.</DialogDescription></DialogHeader>
                <div className="overflow-y-auto p-2">
                  {(["Workspace", "Developer tools", "Account"] as const).map((group) => (
                    <section key={group} className="py-2">
                      <h2 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#827975]">{group}</h2>
                      <div className="grid grid-cols-2 gap-1">
                        {visibleItems.filter((item) => item.group === group && !primaryItems.some((primary) => primary.href === item.href)).map(({ href, label, icon: Icon }) => {
                          const active = pathname === href || pathname.startsWith(`${href}/`);
                          return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm", active ? "bg-white/[.08] text-primary" : "text-[#d7cfcb] hover:bg-white/[.05]")}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></Link>;
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
