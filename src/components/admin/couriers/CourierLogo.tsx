import { COURIERS } from "./providers";
import { imgSrc, useCourierBrandAssets } from "@/lib/courier-apps";

/** Small courier logo (uploaded platform logo, else brand-colour initials). */
export function CourierLogo({ courierKey, className = "h-6 w-6" }: { courierKey: string; className?: string }) {
  const { logo } = useCourierBrandAssets();
  const meta = COURIERS.find((c) => c.key === courierKey);
  const src = imgSrc(logo[courierKey]);
  const label = meta?.label ?? courierKey;
  if (src) return <img src={src} alt={label} loading="lazy" className={`${className} shrink-0 rounded-md bg-background object-contain`} />;
  const initials = label.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-md text-[9px] font-bold text-primary-foreground`}
      style={{ background: meta?.brandColor ?? "hsl(var(--muted-foreground))" }}
      aria-label={label}
    >
      {initials}
    </span>
  );
}
