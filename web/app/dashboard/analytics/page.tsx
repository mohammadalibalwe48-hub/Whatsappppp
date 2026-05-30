"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { apiFetch } from "@/lib/api";
import { BarChart3 } from "lucide-react";

interface Overview {
  totals: { sent: number; verified: number; failed: number; expired: number; pending: number };
  verificationRate: number;
  series: { date: string; sent: number; verified: number; failed: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    apiFetch<{ ok: true } & Overview>("/dashboard/analytics/overview")
      .then(setData)
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Analytics</h1>
        <p className="text-base text-muted-foreground mt-1">Last 30 days of OTP activity across all keys.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="OTPs sent" value={data?.totals.sent ?? "—"} />
        <StatCard
          label="Verified"
          value={data?.totals.verified ?? "—"}
          hint={data ? `${(data.verificationRate * 100).toFixed(1)}% rate` : undefined}
          trend="up"
        />
        <StatCard label="Failed" value={data?.totals.failed ?? "—"} trend="down" />
        <StatCard label="Expired" value={data?.totals.expired ?? "—"} />
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-6 mb-6">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" /> Sent vs verified
          </CardTitle>
          <CardDescription className="text-base mt-1">Daily totals across all of your API keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-failed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fill="url(#grad-sent)"
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="verified"
                    stroke="hsl(var(--success))"
                    strokeWidth={3}
                    fill="none"
                    name="Verified"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={3}
                    fill="url(#grad-failed)"
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full rounded-2xl" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
