// Renders 1–3 preset lucide icons composed inside a square category container.
import { getCategoryIcon, parseIconNames } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIconCluster({
  iconName,
  className,
  strokeWidth = 1.5,
}: {
  iconName?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const icons = parseIconNames(iconName)
    .map((k) => getCategoryIcon(k))
    .filter(Boolean)
    .slice(0, 3) as NonNullable<ReturnType<typeof getCategoryIcon>>[];

  if (icons.length === 0) return null;

  if (icons.length === 1) {
    const A = icons[0];
    return (
      <span className={cn("grid h-full w-full place-items-center", className)}>
        <A className="h-1/2 w-1/2" strokeWidth={strokeWidth} />
      </span>
    );
  }

  if (icons.length === 2) {
    const [A, B] = icons;
    return (
      <span className={cn("relative block h-full w-full", className)}>
        <A
          className="absolute left-[14%] top-[20%] h-[42%] w-[42%]"
          strokeWidth={strokeWidth}
        />
        <B
          className="absolute bottom-[18%] right-[14%] h-[42%] w-[42%] opacity-80"
          strokeWidth={strokeWidth}
        />
      </span>
    );
  }

  const [A, B, C] = icons;
  return (
    <span className={cn("relative block h-full w-full", className)}>
      <A
        className="absolute left-1/2 top-[12%] h-[38%] w-[38%] -translate-x-1/2"
        strokeWidth={strokeWidth}
      />
      <B
        className="absolute bottom-[14%] left-[16%] h-[30%] w-[30%] opacity-80"
        strokeWidth={strokeWidth}
      />
      <C
        className="absolute bottom-[14%] right-[16%] h-[30%] w-[30%] opacity-80"
        strokeWidth={strokeWidth}
      />
    </span>
  );
}
