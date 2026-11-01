import { cn } from "@/lib/utils";

/** Official Instagram glyph on its brand gradient (fixed brand colours are part of the logo). */
export function InstagramMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm", className)}
      style={{
        height: size,
        width: size,
        background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
      }}
      aria-label="Instagram"
      role="img"
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="17.3" cy="6.7" r="1.3" fill="#fff" />
      </svg>
    </span>
  );
}
