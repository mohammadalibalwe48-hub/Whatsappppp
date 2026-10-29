import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, hint, trend = "neutral", icon }: Props) {
  return (
    <Card className="h-full border-border bg-card shadow-sm">
      <CardContent className="p-4 pt-4 sm:p-6 sm:pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold sm:text-3xl tabular-nums tracking-tight text-foreground">{value}</div>
            {hint ? (
              <div
                className={cn("text-xs font-medium", {
                  "text-success": trend === "up",
                  "text-destructive": trend === "down",
                  "text-muted-foreground": trend === "neutral"
                })}
              >
                {hint}
              </div>
            ) : null}
          </div>
          {icon ? (
            <div className="grid h-8 w-8 shrink-0 sm:h-10 sm:w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
