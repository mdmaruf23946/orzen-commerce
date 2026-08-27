// Renders 1–3 preset lucide icons composed inside a square category container.
// Supports two visual styles: minimalist outline, or colored flat-illustrated.
import {
  getCategoryIcon,
  getIconPalette,
  parseIconNames,
  parseIconStyle,
  type CategoryIconStyle,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function CategoryIconCluster({
  iconName,
  className,
  strokeWidth = 1.5,
  iconStyle = "outline",
}: {
  iconName?: string | null;
  className?: string;
  strokeWidth?: number;
  iconStyle?: CategoryIconStyle | string | null;
}) {
  const style = parseIconStyle(typeof iconStyle === "string" ? iconStyle : "outline");
  const palette = getIconPalette(iconName);
  const icons = parseIconNames(iconName)
    .map((k) => getCategoryIcon(k))
    .filter(Boolean)
    .slice(0, 3) as NonNullable<ReturnType<typeof getCategoryIcon>>[];

  if (icons.length === 0) return null;

  const colored = style === "colored";
  const primary = colored ? palette.primary : "currentColor";
  const secondary = colored ? palette.secondary : "currentColor";
  const sw = colored ? Math.max(strokeWidth, 1.9) : strokeWidth;

  const content = (() => {
    if (icons.length === 1) {
      const A = icons[0];
      return (
        <span className="grid h-full w-full place-items-center">
          <A className="h-1/2 w-1/2" strokeWidth={sw} color={primary} />
        </span>
      );
    }

    if (icons.length === 2) {
      const [A, B] = icons;
      return (
        <span className="relative block h-full w-full">
          <A
            className="absolute left-[14%] top-[20%] h-[42%] w-[42%]"
            strokeWidth={sw}
            color={primary}
          />
          <B
            className={cn("absolute bottom-[18%] right-[14%] h-[42%] w-[42%]", !colored && "opacity-80")}
            strokeWidth={sw}
            color={secondary}
          />
        </span>
      );
    }

    const [A, B, C] = icons;
    return (
      <span className="relative block h-full w-full">
        <A
          className="absolute left-1/2 top-[12%] h-[38%] w-[38%] -translate-x-1/2"
          strokeWidth={sw}
          color={primary}
        />
        <B
          className={cn("absolute bottom-[14%] left-[16%] h-[30%] w-[30%]", !colored && "opacity-80")}
          strokeWidth={sw}
          color={secondary}
        />
        <C
          className={cn("absolute bottom-[14%] right-[16%] h-[30%] w-[30%]", !colored && "opacity-80")}
          strokeWidth={sw}
          color={secondary}
        />
      </span>
    );
  })();

  if (!colored) return <span className={cn("block h-full w-full", className)}>{content}</span>;

  return (
    <span
      className={cn("relative block h-full w-full overflow-hidden rounded-[28%]", className)}
      style={{ background: `radial-gradient(120% 120% at 30% 15%, ${palette.glow}, ${palette.bg})` }}
    >
      <span
        className="pointer-events-none absolute -right-[18%] -top-[22%] h-[62%] w-[62%] rounded-full"
        style={{ background: palette.glow, opacity: 0.7 }}
      />
      <span
        className="pointer-events-none absolute -bottom-[26%] -left-[18%] h-[55%] w-[55%] rounded-full"
        style={{ background: palette.primary, opacity: 0.12 }}
      />
      <span className="relative block h-full w-full p-[10%]">{content}</span>
    </span>
  );
}
