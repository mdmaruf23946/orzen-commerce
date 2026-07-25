import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { CourierMeta } from "./providers";

export function BrandBadge({ meta, logoUrl }: { meta: CourierMeta; logoUrl?: string | null }) {
  const initials = meta.label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const src = logoUrl
    ? logoUrl.startsWith("http")
      ? logoUrl
      : `/api/img/${logoUrl}`
    : null;

  if (src) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1 shadow-sm dark:bg-white/95"
        aria-label={meta.label}
      >
        <img
          src={src}
          alt={meta.label}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

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
