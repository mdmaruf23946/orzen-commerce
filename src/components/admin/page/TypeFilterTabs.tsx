import { cn } from "@/lib/utils";
import { useProductTypeScope } from "@/lib/product-type-scope";

const HIDDEN_FOR_PHYSICAL_ONLY = ["digital", "service", "subscription"];

export function TypeFilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  const { physicalOnly } = useProductTypeScope();
  if (physicalOnly) {
    const keys = tabs.map((t) => String(t.key));
    const typeTabs = keys.some((k) => HIDDEN_FOR_PHYSICAL_ONLY.includes(k));
    if (typeTabs) {
      const rest = tabs.filter((t) => !HIDDEN_FOR_PHYSICAL_ONLY.includes(String(t.key)));
      // Only "all"/"physical" left → the type filter is meaningless; hide it.
      if (rest.every((t) => t.key === "all" || t.key === "physical")) return null;
      tabs = rest;
    }
  }
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4",
        className,
      )}
    >
      <div className="flex snap-x gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-pressed={active}
              className={cn(
                "min-h-10 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
