import type { PaymentBrand } from "./providers";

export function BrandMark({
  brand,
  size = "md",
  logoUrl,
}: {
  brand: PaymentBrand;
  size?: "sm" | "md" | "lg";
  logoUrl?: string | null;
}) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  const src = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `/api/img/${logoUrl}`) : null;

  if (src) {
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1 shadow-sm dark:bg-white/95`}
        style={{ borderColor: brand.brandColor + "33" }}
        aria-label={brand.label}
      >
        <img src={src} alt={brand.label} loading="lazy" decoding="async" className="h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm`}
      style={{ background: brand.brandColor }}
      aria-hidden
    >
      {brand.initials}
    </div>
  );
}
