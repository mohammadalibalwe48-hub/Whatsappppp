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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days of OTP activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Sent vs verified</CardTitle>
          <CardDescription>Daily totals across all of your API keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series}>
                  <defs>
                    <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-failed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="hsl(var(--primary))"
                    fill="url(#grad-sent)"
                    name="Sent"
                  />
                  <Area
                    type="monotone"
                    dataKey="verified"
                    stroke="hsl(var(--success))"
                    fill="none"
                    name="Verified"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="hsl(var(--destructive))"
                    fill="url(#grad-failed)"
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
