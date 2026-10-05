import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProviderOverview } from "@/lib/voice-provider.functions";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { startCall } from "@/lib/call-center.functions";
import { CallResultDialog } from "@/components/admin/calls/CallResultDialog";

type Props = {
  phone: string;
  customerName?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  /** "button" = prominent Call Customer, "icon" = compact inline action. */
  variant?: "button" | "icon" | "outline";
  label?: string;
  className?: string;
};

export function CallButton({
  phone, customerName, orderId, customerId, variant = "button", label = "Call Customer", className = "",
}: Props) {
  const call = useServerFn(startCall);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [extension, setExtension] = useState("");
  const overviewFn = useServerFn(getProviderOverview);
  const ov = useQuery({
    queryKey: ["voice", "overview"], queryFn: () => overviewFn(), enabled: confirm, staleTime: 30_000,
  });
  const o: any = ov.data;
  const extOptions: string[] = Array.from(new Set([
    ...(o?.default_extension ? [String(o.default_extension)] : []),
    ...((o?.saved_extensions ?? []) as { extension: string }[]).map((x) => x.extension),
  ]));
  const chosenExt = extension || o?.default_extension || extOptions[0] || "";
  const zeroBalance = o?.connected && o?.balance != null && Number(o.balance) <= 0;

  async function go() {
    if (!phone) return;
    setBusy(true);
    try {
      const res: any = await call({
        data: {
          phone,
          customer_name: customerName ?? null,
          order_id: orderId ?? null,
          customer_id: customerId ?? null,
          ...(chosenExt ? { extension: chosenExt } : {}),
        },
      });
      setConfirm(false);
      if (!res.ok) {
        if (res.reason === "not_connected") setNotConnected(true);
        else setFailed(res.message ?? "The call could not be started.");
        return;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["calls"] }),
        qc.invalidateQueries({ queryKey: ["call-center"] }),
        qc.invalidateQueries({ queryKey: ["order-calls"] }),
        qc.invalidateQueries({ queryKey: ["phone-calls"] }),
        qc.invalidateQueries({ queryKey: ["voice"] }),
      ]);
      toast.success("ePBX call started");
      setResultFor(res.callId);
    } catch {
      setConfirm(false);
      setFailed("The call could not be started.");
    } finally {
      setBusy(false);
    }
  }

  const base =
    variant === "icon"
      ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      : variant === "outline"
        ? "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
        : "inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";

  return (
    <>
      <button
        type="button"
        disabled={!phone}
        onClick={(e) => {
          e.stopPropagation();
          setConfirm(true);
        }}
        className={`${base} ${className} disabled:opacity-50`}
        aria-label={label}
        title={label}
      >
        <Phone className={variant === "button" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {variant !== "icon" && <span>{label}</span>}
      </button>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Call {phone}?</AlertDialogTitle>
            {customerName && <AlertDialogDescription>{customerName}</AlertDialogDescription>}
          </AlertDialogHeader>
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">Your phone/extension rings first. When you answer, ePBX calls the customer.</p>
            {ov.isLoading ? <p className="text-muted-foreground">Checking ePBX…</p> : o && !o.connected ? (
              <p className="text-destructive">ePBX is not connected.</p>
            ) : (
              <>
                {extOptions.length ? (
                  <label className="block">
                    <span className="mb-1 block font-medium text-muted-foreground">Ring this extension first</span>
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={chosenExt} onChange={(e) => setExtension(e.target.value)}>
                      {extOptions.map((x) => <option key={x} value={x}>{x}{x === o?.default_extension ? " (default)" : ""}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="text-destructive">No agent extension saved. Add one in Call & SMS Apps → ePBX → Agents.</p>
                )}
                {zeroBalance && <p className="text-destructive">Your ePBX balance is ৳0 — the call will likely fail until you recharge.</p>}
              </>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void go();
              }}
              disabled={busy || (o && !o.connected)}
            >
              {busy ? "Starting…" : "Call Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={notConnected} onOpenChange={setNotConnected}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Calling provider is not connected.</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Link
              to="/admin/call-sms/epbx"
              search={{ tab: "provider" }}
              onClick={() => setNotConnected(false)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Connect Calling Provider
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!failed} onOpenChange={(v) => !v && setFailed(null)}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Call failed</AlertDialogTitle>
            <AlertDialogDescription>{failed}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setFailed(null);
                setConfirm(true);
              }}
            >
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CallResultDialog
        open={!!resultFor}
        onOpenChange={(v) => !v && setResultFor(null)}
        callId={resultFor}
        manualStatus={true}
        phone={phone}
      />
    </>
  );
}
