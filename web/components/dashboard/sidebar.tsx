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
}

export const dashboardNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Cable },
  { href: "/dashboard/api-keys", label: "API keys", icon: KeyRound },
  { href: "/dashboard/playground", label: "API playground", icon: Play },
  { href: "/dashboard/logs", label: "OTP logs", icon: ListChecks },
  { href: "/dashboard/analytics", label: "Analytics", icon: Activity },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/docs", label: "Docs & MCP", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/admin", label: "Admin", icon: Shield, adminOnly: true }
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
      <ul className="space-y-1">
        {visibleItems.map(({ href, label, icon: Icon }) => {
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
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                <span>{label}</span>
                {active && <span className="sr-only">Current page</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <Link
        href="/dashboard"
        className="flex h-[72px] items-center gap-3 border-b border-border px-6 font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <MessageSquare aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        <span className="text-lg">OtpWave</span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">Workspace</p>
        <DashboardNavigation isAdmin={isAdmin} />
      </div>

      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">Messages, OTPs, and integrations</p>
        <p className="mt-1 text-[11px] text-muted-foreground/75">Your WhatsApp workspace</p>
      </div>
    </aside>
  );
}
