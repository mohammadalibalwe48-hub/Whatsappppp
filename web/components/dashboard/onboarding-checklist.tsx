"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface Step {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

interface Resp {
  ok: true;
  steps: Step[];
  completed: number;
  total: number;
  finished: boolean;
}

export function OnboardingChecklist() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Resp>("/dashboard/onboarding")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data || data.finished) return null;

  const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
  const nextStep = data.steps.find((step) => !step.done);

  return (
    <Card className="border-primary/20 bg-primary/[0.025] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Get started with OtpWave
            </CardTitle>
            <CardDescription>
              {data.completed} of {data.total} steps complete
            </CardDescription>
          </div>
          {nextStep && <Button asChild size="sm"><Link href={nextStep.href}>Continue setup <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>}
        </div>
        <div role="progressbar" aria-label="Workspace setup" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.steps.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className={`group flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  s.done
                    ? "border-border/60 bg-card/40"
                    : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {s.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      s.done ? "line-through decoration-muted-foreground/40" : ""
                    }`}
                  >
                    {s.title}
                    {s.done && <span className="sr-only"> — complete</span>}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{s.description}</div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
