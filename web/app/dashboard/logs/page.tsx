"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, ListChecks, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Log {
  id: string;
  phone_number: string;
  status: string;
  app_name: string | null;
  created_at: string;
  failure_reason: string | null;
}
interface LogsResponse { logs: Log[]; total: number }
const pageSize = 25;

export default function OtpLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", page: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ limit: String(pageSize), page: String(filters.page) });
    if (filters.q) query.set("q", filters.q);
    if (filters.status) query.set("status", filters.status);
    apiFetch<LogsResponse>(`/dashboard/otp-logs?${query}`)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Delivery history</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">OTP logs</h1>
          <p className="mt-2 text-sm text-muted-foreground">Find a delivery and check its verification status.</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6 md:pt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form className="flex flex-1 items-end gap-2" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, q: search.trim(), page: 0 })); }}>
              <div className="flex-1 space-y-2">
                <label htmlFor="phone-search" className="text-sm font-medium">Phone number</label>
                <Input id="phone-search" type="search" placeholder="Search by phone number…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Button type="submit" variant="outline" aria-label="Search OTP logs"><Search aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Search</span></Button>
            </form>
            <div className="space-y-2 sm:w-44">
              <label htmlFor="status-filter" className="block text-sm font-medium">Status</label>
              <select id="status-filter" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 0 }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">All statuses</option>
                {["pending", "verified", "failed", "expired"].map((status) => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}
              </select>
            </div>
            {(filters.q || filters.status) && <Button variant="ghost" onClick={() => { setSearch(""); setFilters({ q: "", status: "", page: 0 }); }}>Clear filters</Button>}
          </div>

          <div aria-busy={loading}>
            {loading ? <div className="space-y-3">{[1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div> : error ? (
              <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center">
                <AlertCircle aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-destructive" />
                <p className="text-sm">We couldn’t load your OTP logs.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setRefresh((value) => value + 1)}>Try again</Button>
              </div>
            ) : !data?.logs.length ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-12 text-center">
                <ListChecks aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-primary" />
                <p className="font-semibold">{filters.q || filters.status ? "No matching OTPs" : "No OTPs yet"}</p>
                <p className="mt-2 text-sm text-muted-foreground">{filters.q || filters.status ? "Try another phone number or clear your filters." : "Send your first test OTP to see its delivery status here."}</p>
                {!filters.q && !filters.status && <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/dashboard/playground">Open playground <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></Button>}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">OTP delivery history</caption>
                  <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Recipient", "Application", "Status", "Created"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">{data.logs.map((log) => <tr key={log.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-4 font-medium">{log.phone_number}</td>
                    <td className="px-4 py-4">{log.app_name || "Default app"}</td>
                    <td className="px-4 py-4"><Badge variant={log.status === "verified" ? "success" : log.status === "failed" || log.status === "expired" ? "destructive" : log.status === "pending" ? "warning" : "default"}>{log.status}</Badge>{log.failure_reason && <p className="mt-2 min-w-40 max-w-xs text-xs text-muted-foreground">{log.failure_reason}</p>}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground"><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && !error && data && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p role="status" className="text-xs text-muted-foreground">{data.total ? `${filters.page * pageSize + 1}–${Math.min((filters.page + 1) * pageSize, data.total)} of ${data.total} OTPs` : "0 OTPs"}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={filters.page === 0} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft aria-hidden="true" className="h-4 w-4" />Previous</Button>
              <Button variant="outline" size="sm" disabled={(filters.page + 1) * pageSize >= data.total} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next<ArrowRight aria-hidden="true" className="h-4 w-4" /></Button>
            </div>
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
