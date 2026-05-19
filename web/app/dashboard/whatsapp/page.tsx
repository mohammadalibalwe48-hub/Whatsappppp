"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Power, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionStatusPill } from "@/components/dashboard/session-status-pill";
import { useWhatsappSession } from "@/lib/hooks/use-session";

export default function WhatsappPage() {
  const session = useWhatsappSession();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "start" | "stop" | "logout") {
    setBusy(action);
    try {
      if (action === "start") await session.start();
      if (action === "stop") await session.stop();
      if (action === "logout") await session.logout();
      toast.success(`Session ${action}`);
    } catch (err: any) {
      toast.error(err.message ?? `Failed to ${action} session`);
    } finally {
      setBusy(null);
    }
  }

  const s = session.state;
  const status = s?.status ?? "disconnected";
  const showQr = status === "qr" && s?.qrDataUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp connection</h1>
          <p className="text-sm text-muted-foreground">
            Pair your personal WhatsApp account to start sending OTPs.
          </p>
        </div>
        {s ? <SessionStatusPill status={status} /> : <Skeleton className="h-6 w-24" />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Pair with QR code
          </CardTitle>
          <CardDescription>
            Open WhatsApp on your phone → <strong>Settings → Linked devices → Link a device</strong>
            , then scan this QR code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 bg-card/40 p-6">
            {session.loading && !s ? (
              <Skeleton className="h-72 w-72" />
            ) : status === "connected" ? (
              <ConnectedView phoneNumber={s?.phoneNumber} />
            ) : showQr ? (
              <img
                src={s!.qrDataUrl!}
                alt="WhatsApp pairing QR"
                className="h-72 w-72 rounded-md bg-white p-2"
              />
            ) : status === "initializing" ? (
              <div className="flex h-72 w-72 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <EmptyView />
            )}
          </div>

          {s?.lastError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Last error</div>
                <div className="text-destructive/90">{s.lastError}</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {status !== "connected" ? (
              <Button onClick={() => run("start")} disabled={busy !== null}>
                {busy === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {status === "qr" ? "Refresh QR" : "Generate QR / Reconnect"}
              </Button>
            ) : null}
            {status === "connected" ? (
              <Button variant="outline" onClick={() => run("stop")} disabled={busy !== null}>
                <Power className="h-4 w-4" /> Disconnect
              </Button>
            ) : null}
            {(status === "connected" || status === "qr") && (
              <Button variant="destructive" onClick={() => run("logout")} disabled={busy !== null}>
                Log out & wipe credentials
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How session persistence works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            We persist Baileys auth state to disk (encrypted at rest) so your session survives
            server restarts and reconnects automatically when WhatsApp drops the socket.
          </p>
          <p>
            Logging out wipes the credentials on disk. On the next pair, your phone will treat
            OtpWave as a new linked device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectedView({ phoneNumber }: { phoneNumber?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
        <Power className="h-7 w-7" />
      </div>
      <div className="text-lg font-semibold">WhatsApp is connected</div>
      <div className="text-sm text-muted-foreground">
        {phoneNumber ? `Sending OTPs from +${phoneNumber}` : "Linked device active"}
      </div>
    </div>
  );
}

function EmptyView() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <QrCode className="h-7 w-7" />
      </div>
      <div className="text-lg font-semibold">Not connected yet</div>
      <div className="max-w-sm text-sm text-muted-foreground">
        Click <strong>Generate QR / Reconnect</strong> below to start. A QR code will appear here
        in a few seconds.
      </div>
    </div>
  );
}
