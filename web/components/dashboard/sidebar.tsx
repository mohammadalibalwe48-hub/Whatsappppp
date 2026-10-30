"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Cable,
  Home,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquare,
  Play,
  Settings,
  Shield,
  Webhook
} from "lucide-react";
import { cn } from "@/lib/utils";

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
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group}</p>
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
                        ? "bg-indigo-400/15 text-white shadow-sm shadow-black/10"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("h-[18px] w-[18px] shrink-0", active ? "text-indigo-300" : "text-slate-400 group-hover:text-slate-200")} />
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
    <aside className="sticky top-0 hidden h-dvh w-[250px] shrink-0 border-r border-slate-800 bg-[#0c1220] text-slate-100 lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="flex h-[76px] items-center gap-3 border-b border-slate-800 px-6 font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 text-white shadow-lg shadow-indigo-950/40">
          <MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        <span><span className="block text-lg leading-5">OtpWave</span><span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Operations hub</span></span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <DashboardNavigation isAdmin={isAdmin} />
      </div>

      <div className="m-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-semibold text-white">Building an integration?</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">Find examples and connect your AI tools.</p>
        <Link href="/dashboard/docs" className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-indigo-300">
          <BookOpen aria-hidden="true" className="h-4 w-4" /> Open documentation
        </Link>
      </div>
    </aside>
  );
}
