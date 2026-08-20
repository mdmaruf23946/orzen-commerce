import { cn } from "@/lib/utils";

/** Official Messenger glyph inside the official blue-purple gradient badge. */
export function MessengerMark({
  size = 40,
  className,
  plain = false,
}: {
  size?: number;
  className?: string;
  /** Render only the glyph (currentColor), no gradient badge. */
  plain?: boolean;
}) {
  const glyph = (
    <svg viewBox="0 0 32 32" width={plain ? size : size * 0.66} height={plain ? size : size * 0.66} aria-hidden>
      <path
        fill="currentColor"
        d="M16 3C8.82 3 3 8.42 3 15.1c0 3.8 1.89 7.19 4.84 9.4v4.6l4.43-2.43c1.18.33 2.43.5 3.73.5 7.18 0 13-5.41 13-12.09C29 8.42 23.18 3 16 3Zm7.1 9.36-3.53 5.6a1.19 1.19 0 0 1-1.72.32l-2.81-2.11a.73.73 0 0 0-.87 0l-3.79 2.88c-.5.38-1.16-.22-.82-.76l3.53-5.6a1.19 1.19 0 0 1 1.72-.32l2.81 2.1c.26.2.62.2.87.01l3.79-2.87c.5-.39 1.16.21.82.75Z"
      />
    </svg>
  );

  if (plain) return <span className={cn("inline-flex text-messenger", className)}>{glyph}</span>;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl text-messenger-foreground shadow-sm", className)}
      style={{ height: size, width: size, background: "var(--gradient-messenger)" }}
      aria-label="Messenger"
      role="img"
    >
      {glyph}
    </span>
  );
}
