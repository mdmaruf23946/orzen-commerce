import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { CourierMeta } from "./providers";

export function BrandBadge({ meta }: { meta: CourierMeta }) {
  const initials = meta.label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
      style={{ background: meta.brandColor }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function StatusChip({ status }: { status?: string | null }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Disconnected
    </span>
  );
}

export function VerifiedBadge({ color }: { color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: color + "1A", color }}
    >
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  );
}
