"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, getAccessToken, apiUrl } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface OtpLog {
  id: string;
  user_id: string;
  phone_number: string;
  status: string;
  attempts: number;
  created_at: string;
  verified_at: string | null;
  app_name: string | null;
  profiles: { email: string } | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-success/15 text-success hover:bg-success/20 shadow-sm border-success/30">verified</Badge>;
    case "pending":
      return <Badge variant="warning" className="shadow-sm">pending</Badge>;
    case "expired":
      return <Badge variant="outline" className="shadow-sm">expired</Badge>;
    case "failed":
      return <Badge variant="destructive" className="shadow-sm">failed</Badge>;
    default:
      return <Badge variant="secondary" className="shadow-sm">{status}</Badge>;
  }
}

export default function AdminOtpLogsPage() {
  const [logs, setLogs] = useState<OtpLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(
    async (
      p: number,
      currentStatus: string,
      currentPhone: string,
      currentSince: string,
      currentUntil: string
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("page", String(p));
        if (currentStatus) params.set("status", currentStatus);
        if (currentPhone) params.set("phone", currentPhone);
        if (currentSince) params.set("since", new Date(currentSince).toISOString());
        if (currentUntil) params.set("until", new Date(currentUntil).toISOString());
        const data = await apiFetch<{
          ok: true;
          logs: OtpLog[];
          total: number;
        }>(`/admin/otp-logs?${params.toString()}`);
        setLogs(data.logs);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  function load(p = page) {
    fetchLogs(p, status, phone, since, until);
  }

  useEffect(() => {
    fetchLogs(0, "", "", "", "");
  }, [fetchLogs]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    fetchLogs(0, status, phone, since, until);
  }

  function reset() {
    setStatus("");
    setPhone("");
    setSince("");
    setUntil("");
    setPage(0);
    setTimeout(() => fetchLogs(0, "", "", "", ""), 0);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (phone) params.set("phone", phone);
      if (since) params.set("since", new Date(since).toISOString());
      if (until) params.set("until", new Date(until).toISOString());

      const token = await getAccessToken();
      const res = await fetch(`${apiUrl}/admin/otp-logs.csv?${params.toString()}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `otpwave-otp-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10 pb-5 mb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Filter className="h-5 w-5 text-primary" /> Filters
            </CardTitle>
            <CardDescription className="text-base mt-1">{total.toLocaleString()} matching logs found.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || loading}
            onClick={exportCsv}
            className="shadow-sm self-start sm:self-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-1 space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
              >
                <option value="">Any</option>
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="expired">expired</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Phone</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="+1555…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9 bg-muted/20 focus-visible:ring-primary/30"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">From</label>
              <Input
                type="datetime-local"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                className="bg-muted/20 focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">To</label>
              <Input
                type="datetime-local"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="bg-muted/20 focus-visible:ring-primary/30"
              />
            </div>
            <div className="flex items-end gap-3 md:col-span-5 pt-2">
              <Button type="submit" className="shadow-sm">
                Apply Filters
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="shadow-sm">
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">OTP logs</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive mb-4">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-12 text-center text-sm text-muted-foreground">
              No matching logs found. Adjust filters to see more results.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground/80 bg-muted/40 border-b border-border/40">
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">App</th>
                    <th className="px-4 py-3 font-semibold">Attempts</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {logs.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 whitespace-nowrap">{statusBadge(l.status)}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground/90 whitespace-nowrap">{l.phone_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground/90 whitespace-nowrap">
                         <span className="bg-muted/50 px-2 py-1 rounded">{l.profiles?.email ?? l.user_id.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground/80 whitespace-nowrap">{l.app_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.attempts}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground/80 whitespace-nowrap">
                        {formatRelative(l.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 ? (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium text-muted-foreground">
              <span className="bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40">
                Page <span className="text-foreground">{page + 1}</span> of {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 0 || loading}
                  onClick={() => {
                    setPage(page - 1);
                    load(page - 1);
                  }}
                  className="shadow-sm"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={page + 1 >= pages || loading}
                  onClick={() => {
                    setPage(page + 1);
                    load(page + 1);
                  }}
                  className="shadow-sm"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
