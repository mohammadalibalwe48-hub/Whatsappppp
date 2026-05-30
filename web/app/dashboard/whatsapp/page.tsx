"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Power, QrCode, RefreshCw, Smartphone, ShieldCheck } from "lucide-react";
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">WhatsApp connection</h1>
          <p className="text-base text-muted-foreground mt-1">
            Pair your personal WhatsApp account to start sending OTPs.
          </p>
        </div>
        {s ? <SessionStatusPill status={status} /> : <Skeleton className="h-8 w-28 rounded-full" />}
      </div>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/10 pb-6 mb-6">
          <CardTitle className="flex items-center gap-2 text-xl">
            <QrCode className="h-5 w-5 text-primary" /> Pair with QR code
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Open WhatsApp on your phone → <strong>Settings → Linked devices → Link a device</strong>
            , then scan this QR code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/5 p-8 transition-colors hover:bg-muted/10">
            {session.loading && !s ? (
              <Skeleton className="h-72 w-72 rounded-xl" />
            ) : status === "connected" ? (
              <ConnectedView phoneNumber={s?.phoneNumber} />
            ) : showQr ? (
              <div className="relative p-3 bg-white rounded-2xl shadow-lg border border-border/10 animate-fade-in">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s!.qrDataUrl!}
                  alt="WhatsApp pairing QR"
                  className="h-[280px] w-[280px] rounded-lg"
                />
              </div>
            ) : status === "initializing" ? (
              <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground border border-border/40">
                <div className="flex flex-col items-center gap-3">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                   <span className="text-sm font-medium">Initializing session...</span>
                </div>
              </div>
            ) : (
              <EmptyView />
            )}
          </div>

          {s?.lastError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm animate-fade-in">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold text-base mb-1">Session error</div>
                <div className="text-destructive/90 leading-relaxed">{s.lastError}</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2 justify-center sm:justify-start">
            {status !== "connected" ? (
              <Button onClick={() => run("start")} disabled={busy !== null} className="shadow-sm">
                {busy === "start" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {status === "qr" ? "Refresh QR" : "Generate QR / Reconnect"}
              </Button>
            ) : null}
            {status === "connected" ? (
              <Button variant="outline" onClick={() => run("stop")} disabled={busy !== null} className="shadow-sm">
                <Power className="mr-2 h-4 w-4 text-warning" /> Disconnect
              </Button>
            ) : null}
            {(status === "connected" || status === "qr") && (
              <Button variant="outline" onClick={() => run("logout")} disabled={busy !== null} className="text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm">
                <Trash2 className="mr-2 h-4 w-4" /> Log out & wipe credentials
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg shadow-black/5 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" /> Session persistence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground/90 leading-relaxed bg-muted/20 p-6 rounded-b-xl border-t border-border/40">
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

// Temporary trash icon since it wasn't imported at top
import { Trash2 } from "lucide-react";

function ConnectedView({ phoneNumber }: { phoneNumber?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-8 animate-fade-in">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success shadow-inner border border-success/20">
        <Power className="h-10 w-10" />
      </div>
      <div>
         <div className="text-2xl font-bold text-foreground/90">WhatsApp is connected</div>
         <div className="text-base text-muted-foreground mt-2 bg-muted/40 px-3 py-1 rounded-full border border-border/40 inline-block">
           {phoneNumber ? `Sending OTPs from +${phoneNumber}` : "Linked device active"}
         </div>
      </div>
    </div>
  );
}

function EmptyView() {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-8">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-muted text-muted-foreground border border-border/40">
        <Smartphone className="h-10 w-10" />
      </div>
      <div>
         <div className="text-2xl font-bold text-foreground/90">Not connected yet</div>
         <div className="max-w-md text-base text-muted-foreground mt-2 leading-relaxed">
           Click <strong>Generate QR / Reconnect</strong> below to start. A QR code will appear here
           in a few seconds.
         </div>
      </div>
    </div>
  );
}
