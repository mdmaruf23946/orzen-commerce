import { cn } from "@/lib/utils";

/** Official WhatsApp glyph inside the official green rounded badge. */
export function WhatsAppMark({
  size = 40,
  className,
  plain = false,
}: {
  size?: number;
  className?: string;
  /** Render only the glyph (currentColor), no colored badge. */
  plain?: boolean;
}) {
  const glyph = (
    <svg viewBox="0 0 32 32" width={plain ? size : size * 0.62} height={plain ? size : size * 0.62} aria-hidden>
      <path
        fill="currentColor"
        d="M16.04 4c-6.6 0-11.96 5.36-11.96 11.96 0 2.11.55 4.17 1.6 5.99L4 28l6.2-1.62a11.9 11.9 0 0 0 5.84 1.52h.01c6.59 0 11.95-5.36 11.95-11.96C28 9.36 22.63 4 16.04 4Zm0 21.85h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.22-3.68.96.98-3.59-.24-.37a9.86 9.86 0 0 1-1.51-5.29c0-5.48 4.46-9.94 9.94-9.94 2.66 0 5.15 1.04 7.03 2.92a9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.88-10.01 9.88Zm5.45-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.09 3.19 5.07 4.47.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z"
      />
    </svg>
  );

  if (plain) return <span className={cn("inline-flex text-whatsapp", className)}>{glyph}</span>;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl text-whatsapp-foreground shadow-sm", className)}
      style={{ height: size, width: size, background: "var(--gradient-whatsapp)" }}
      aria-label="WhatsApp"
      role="img"
    >
      {glyph}
    </span>
  );
}
