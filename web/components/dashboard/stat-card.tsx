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
    <Card className="shadow-md shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm group hover:-translate-y-1 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{label}</div>
            <div className="text-3xl font-bold tracking-tight text-foreground/90">{value}</div>
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
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 shadow-sm shadow-primary/10">
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
