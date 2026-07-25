import { CheckCircle2, XCircle, ShieldCheck, CircleDashed, PauseCircle } from "lucide-react";

export type GatewayStatus = "connected" | "verified" | "error" | "disabled" | "none";

export function StatusBadge({ status, color }: { status: GatewayStatus; color?: string }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold";
  if (status === "verified") {
    const c = color ?? "#059669";
    return (
      <span className={base} style={{ background: c + "1A", color: c }}>
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700`}>
        <CheckCircle2 className="h-3 w-3" /> Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${base} bg-red-100 text-red-700`}>
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  if (status === "disabled") {
    return (
      <span className={`${base} bg-muted text-muted-foreground`}>
        <PauseCircle className="h-3 w-3" /> Disabled
      </span>
    );
  }
  return (
    <span className={`${base} bg-muted text-muted-foreground`}>
      <CircleDashed className="h-3 w-3" /> Not connected
    </span>
  );
}
