import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void go();
              }}
              disabled={busy}
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
              to="/admin/ai-call-center"
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
        manualStatus={false}
        phone={phone}
      />
    </>
  );
}
