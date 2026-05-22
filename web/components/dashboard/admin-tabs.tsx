"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Cable,
  KeyRound,
  ListChecks,
  Server,
  Shield,
  Users,
  Webhook
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/admin", label: "Overview", icon: Activity, exact: true },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/dashboard/admin/otp-logs", label: "OTP Logs", icon: ListChecks },
  { href: "/dashboard/admin/sessions", label: "Sessions", icon: Cable },
  { href: "/dashboard/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/admin/admins", label: "Admins", icon: Shield },
  { href: "/dashboard/admin/system", label: "System", icon: Server }
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
