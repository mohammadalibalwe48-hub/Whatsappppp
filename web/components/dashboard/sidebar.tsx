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

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Cable },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/playground", label: "Playground", icon: Play },
  { href: "/dashboard/logs", label: "OTP Logs", icon: ListChecks },
  { href: "/dashboard/analytics", label: "Analytics", icon: Activity },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/docs", label: "Documentation", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/admin", label: "Admin", icon: Shield, adminOnly: true },
];

interface DashboardSidebarProps {
  isAdmin?: boolean;
}

export function DashboardSidebar({ isAdmin = false }: DashboardSidebarProps) {
  const pathname = usePathname();
  
  const filteredItems = items.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/40 bg-card/50 backdrop-blur-xl md:flex md:flex-col relative z-10 shadow-lg shadow-black/5">
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-6 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span>OtpWave</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar">
        <ul className="space-y-1.5">
          {filteredItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {active && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full" />
                  )}
                  <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active ? "text-primary" : "")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border/40 p-5 text-xs font-medium text-muted-foreground/60 bg-muted/20">
        Powered by Baileys, Supabase & Redis
      </div>
    </aside>
  );
}
