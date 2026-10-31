import { Card, CardContent } from "@/components/ui/card";
import { MagicCard } from "@/components/magic-ui/magic-card";
import { NumberTicker } from "@/components/magic-ui/number-ticker";
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
    <MagicCard className="h-full rounded-2xl">
      <Card className="h-full border-transparent bg-transparent shadow-none">
      <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl tabular-nums">{typeof value === "number" ? <NumberTicker value={value} /> : value}</div>
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
    </MagicCard>
  );
}
