"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Cable,
  Home,
  KeyRound,
  ListChecks,
  MessageSquare,
  Settings,
  Webhook
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Cable },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/logs", label: "OTP Logs", icon: ListChecks },
  { href: "/dashboard/analytics", label: "Analytics", icon: Activity },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/docs", label: "Documentation", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5 font-semibold">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <MessageSquare className="h-4 w-4" />
        </div>
        <span>OtpWave</span>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border/60 p-4 text-xs text-muted-foreground">
        Powered by Baileys · Supabase · Redis
      </div>
    </aside>
  );
}
