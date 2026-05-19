import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

const labels: Record<string, { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "bg-success/15 text-success" },
  qr: { label: "Awaiting scan", tone: "bg-warning/15 text-warning" },
  pairing: { label: "Pairing", tone: "bg-warning/15 text-warning" },
  initializing: { label: "Connecting…", tone: "bg-muted text-muted-foreground" },
  disconnected: { label: "Disconnected", tone: "bg-muted text-muted-foreground" },
  logged_out: { label: "Logged out", tone: "bg-destructive/15 text-destructive" },
  error: { label: "Error", tone: "bg-destructive/15 text-destructive" }
};

export function SessionStatusPill({ status, className }: Props) {
  const meta = labels[status] ?? { label: status, tone: "bg-muted text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.tone,
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-success animate-pulse-soft": status === "connected",
          "bg-warning": status === "qr" || status === "pairing" || status === "initializing",
          "bg-destructive": status === "logged_out" || status === "error",
          "bg-muted-foreground": status === "disconnected"
        })}
      />
      {meta.label}
    </span>
  );
}
