"use client";

import { useEffect, useState } from "react";
import { Download, Filter, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, apiUrl, getAccessToken } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

interface OtpLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  phone_number: string;
  status: string;
  attempts: number;
  app_name: string | null;
  delivered_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
  failure_reason: string | null;
  profiles?: { email: string | null } | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-500/15 text-green-500 hover:bg-green-500/15">verified</Badge>;
    case "pending":
      return <Badge variant="secondary">pending</Badge>;
    case "expired":
      return <Badge variant="outline">expired</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
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

  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("page", String(p));
      if (status) params.set("status", status);
      if (phone) params.set("phone", phone);
      if (since) params.set("since", new Date(since).toISOString());
      if (until) params.set("until", new Date(until).toISOString());
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
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    load(0);
  }

  function reset() {
    setStatus("");
    setPhone("");
    setSince("");
    setUntil("");
    setPage(0);
    setTimeout(() => load(0), 0);
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
            <CardDescription>{total.toLocaleString()} matching logs</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || loading}
            onClick={exportCsv}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Any</option>
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="expired">expired</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="+1555…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <Input
                type="datetime-local"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <Input
                type="datetime-local"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-5">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OTP logs</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No matching logs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Phone</th>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">App</th>
                    <th className="px-2 py-2">Attempts</th>
                    <th className="px-2 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-2">{statusBadge(l.status)}</td>
                      <td className="px-2 py-2 font-mono text-xs">{l.phone_number}</td>
                      <td className="px-2 py-2 text-xs">{l.profiles?.email ?? l.user_id.slice(0, 8)}</td>
                      <td className="px-2 py-2 text-xs">{l.app_name ?? "—"}</td>
                      <td className="px-2 py-2 text-xs">{l.attempts}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {formatRelative(l.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page + 1} of {pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() => {
                    setPage(page - 1);
                    load(page - 1);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages || loading}
                  onClick={() => {
                    setPage(page + 1);
                    load(page + 1);
                  }}
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
