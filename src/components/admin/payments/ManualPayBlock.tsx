// Shared branded UI for manual mobile-wallet payments (bKash / Nagad / Rocket).
// Used by the plan checkout page and the Wallet "Add Fund" dialog so both
// screens look and behave identically.
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getBrand, type PaymentBrand } from "./providers";

export type ManualMethodKey = "bkash" | "nagad" | "rocket";

export function brandOf(method: string): PaymentBrand {
  return getBrand(method);
}

/** Simple, sharp vector marks — no bitmap logos. */
export function MethodLogo({ method, className = "h-6 w-6" }: { method: string; className?: string }) {
  const brand = brandOf(method);
  if (method === "bkash") {
    return (
      <svg viewBox="0 0 32 32" className={className} role="img" aria-label="bKash">
        <rect width="32" height="32" rx="8" fill={brand.brandColor} />
        <path d="M9 8h3v7.2l5.4-4.1h4.2l-6 4.5 6.4 6.4h-4.2L12 17.4V24H9z" fill="#fff" />
        <circle cx="23" cy="9.5" r="2" fill="#fff" />
      </svg>
    );
  }
  if (method === "nagad") {
    return (
      <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Nagad">
        <rect width="32" height="32" rx="8" fill={brand.brandColor} />
        <path d="M10 24V8h3.4l6.2 9.6V8H23v16h-3.4l-6.2-9.6V24z" fill="#fff" />
      </svg>
    );
  }
  if (method === "rocket") {
    return (
      <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Rocket">
        <rect width="32" height="32" rx="8" fill={brand.brandColor} />
        <path
          d="M16 6c3.6 2.6 5.4 6.2 5.4 10.2 0 1.4-.2 2.7-.6 3.9h-9.6a13 13 0 0 1-.6-3.9C10.6 12.2 12.4 8.6 16 6z"
          fill="#fff"
        />
        <circle cx="16" cy="14" r="2" fill={brand.brandColor} />
        <path d="M12.4 21.4h7.2L18 26h-4z" fill="#fff" opacity=".85" />
      </svg>
    );
  }
  return (
    <span
      className={`grid place-items-center rounded-lg text-[10px] font-bold text-white ${className}`}
      style={{ background: brand.brandColor }}
    >
      {brand.initials}
    </span>
  );
}

export function MethodTabs({
  methods,
  value,
  onChange,
  compact = false,
}: {
  methods: readonly string[];
  value: string;
  onChange: (m: any) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-2 ${methods.length >= 3 ? "grid-cols-3" : methods.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {methods.map((k) => {
        const brand = brandOf(k);
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            aria-pressed={active}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 font-semibold transition active:scale-[0.98] ${
              compact ? "px-2 py-2 text-xs" : "px-3 py-3 text-sm"
            }`}
            style={
              active
                ? { background: brand.brandColor, borderColor: brand.brandColor, color: "#fff" }
                : { background: brand.accentColor, borderColor: "transparent", color: brand.brandColor }
            }
          >
            <MethodLogo method={k} className={compact ? "h-5 w-5" : "h-6 w-6"} />
            <span>{brand.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BrandCopyRow({
  label,
  value,
  brand,
  mono = true,
}: {
  label: string;
  value: string;
  brand: PaymentBrand;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    try {
      void navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  }
  return (
    <div className="space-y-1.5">
      <div
        className="text-[11px] font-bold uppercase tracking-wide"
        style={{ color: brand.brandColor }}
      >
        {label}
      </div>
      <div
        className="flex items-stretch gap-2 rounded-2xl border-2 p-2"
        style={{ borderColor: brand.brandColor, background: brand.accentColor }}
      >
        <div
          className={`flex flex-1 items-center px-2 text-xl font-extrabold tracking-wide sm:text-2xl ${mono ? "font-mono" : ""}`}
          style={{ color: brand.brandColor }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="inline-flex min-w-[64px] items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-white transition active:scale-95"
          style={{ background: brand.brandColor }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

export function BrandSteps({ steps, brand }: { steps: string[]; brand: PaymentBrand }) {
  return (
    <div>
      <div
        className="mb-2 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: brand.brandColor }}
      >
        Instructions
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span
              className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ background: brand.brandColor }}
            >
              {i + 1}
            </span>
            <span className="pt-0.5 leading-snug">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BrandPanel({
  brand,
  children,
  className = "",
}: {
  brand: PaymentBrand;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`space-y-4 rounded-2xl border-2 bg-card p-4 shadow-sm ${className}`}
      style={{ borderColor: brand.brandColor }}
    >
      {children}
    </div>
  );
}
