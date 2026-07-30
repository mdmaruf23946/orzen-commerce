import { Grid2x2, LayoutDashboard, Lock, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMING_SOON, KINDS, type DesignKind } from "@/lib/design-studio/registry";

export type StudioView = "dashboard" | "designs" | "brand" | DesignKind;

const MAIN: { id: StudioView; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "designs", label: "My Designs", icon: Grid2x2 },
  { id: "brand", label: "Brand Kit", icon: Palette },
];

function Item({
  icon: Icon,
  label,
  active,
  disabled,
  collapsed,
  onClick,
}: {
  icon: any;
  label: string;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "bg-primary/10 font-medium text-primary"
          : disabled
            ? "text-muted-foreground/70 hover:bg-muted/60"
            : "text-foreground/80 hover:bg-muted",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && disabled && <Lock className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  );
}

export function StudioSidebar({
  view,
  onView,
  onComingSoon,
  collapsed,
}: {
  view: StudioView;
  onView: (v: StudioView) => void;
  onComingSoon: (label: string) => void;
  collapsed?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-2.5">
      <div className="space-y-1">
        {MAIN.map((m) => (
          <Item
            key={m.id}
            icon={m.icon}
            label={m.label}
            active={view === m.id}
            collapsed={collapsed}
            onClick={() => onView(m.id)}
          />
        ))}
      </div>

      <div className="space-y-1">
        {!collapsed && (
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Design Studio
          </div>
        )}
        {KINDS.map((k) => (
          <Item
            key={k.id}
            icon={k.icon}
            label={k.label}
            active={view === k.id}
            collapsed={collapsed}
            onClick={() => onView(k.id)}
          />
        ))}
      </div>

      <div className="space-y-1">
        {!collapsed && (
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Coming Soon
          </div>
        )}
        {COMING_SOON.map((c) => (
          <Item
            key={c.id}
            icon={c.icon}
            label={c.label}
            disabled
            collapsed={collapsed}
            onClick={() => onComingSoon(c.label)}
          />
        ))}
      </div>
    </div>
  );
}
