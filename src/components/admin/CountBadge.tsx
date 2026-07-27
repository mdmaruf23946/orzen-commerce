import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  label?: string;
  className?: string;
  variant?: "pill" | "dot";
}

export function CountBadge({ count, label, className, variant = "pill" }: Props) {
  const prev = useRef(count);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (count > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count]);

  if (!count || count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);
  const aria = label ? `${count} unread ${label}` : `${count} unread`;

  if (variant === "dot") {
    return (
      <span
        aria-label={aria}
        className={cn(
          "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar",
          pulse && "animate-pulse",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-label={aria}
      className={cn(
        "ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground",
        pulse && "animate-pulse",
        className,
      )}
    >
      {display}
    </span>
  );
}
