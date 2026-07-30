import { Link } from "@tanstack/react-router";
import {
  Award,
  Box,
  FolderOpen,
  Globe,
  Grid2x2,
  IdCard,
  Instagram,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  MoreHorizontal,
  Palette,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KINDS, type DesignKind } from "@/lib/design-studio/registry";

export type StudioView = "dashboard" | "designs" | "brand" | DesignKind;

const MAIN: { id: StudioView; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "designs", label: "My Designs", icon: Grid2x2 },
  { id: "brand", label: "Brand Kit", icon: Palette },
];

/** Locked studio entries shown inline with the live design kinds. */
const LOCKED_STUDIO: { id: string; label: string; icon: any }[] = [
  { id: "social", label: "Social Media", icon: Instagram },
  { id: "landing", label: "Landing Page", icon: LayoutTemplate },
  { id: "business-card", label: "Business Card", icon: IdCard },
  { id: "certificate", label: "Certificate", icon: Award },
  { id: "packaging", label: "Packaging", icon: Box },
  { id: "more", label: "More Tools", icon: MoreHorizontal },
];

const LIBRARY: { id: string; label: string; icon: any }[] = [
  { id: "templates", label: "Templates", icon: Grid2x2 },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "website", label: "Website Builder", icon: Globe },
];

function Item({
  icon: Icon,
  label,
  active,
  disabled,
  collapsed,
  badge,
  onClick,
}: {
  icon: any;
  label: string;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : disabled
            ? "text-muted-foreground/70 hover:bg-muted/60"
            : "text-foreground/80 hover:bg-muted",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && badge && (
        <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary">
          {badge}
        </span>
      )}
      {!collapsed && disabled && <Lock className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  );
}

export function StudioSidebar({
  view,
  onView,
  onComingSoon,
  onCreateNew,
  collapsed,
}: {
  view: StudioView;
  onView: (v: StudioView) => void;
  onComingSoon: (label: string) => void;
  onCreateNew?: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="pb-3">
        <Button
          onClick={() => (onCreateNew ? onCreateNew() : onView("invoice"))}
          className={cn(
            "w-full justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/70 py-5 font-semibold shadow-sm",
            collapsed && "px-0",
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "Create New"}
        </Button>
      </div>

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

      <div className="mt-4 space-y-1">
        {!collapsed && (
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Origin Studio
          </div>
        )}
        {KINDS.map((k) => (
          <Item
            key={k.id}
            icon={k.icon}
            label={k.label.replace(" Builder", "").replace(" Maker", "").replace(" Designer", "")}
            active={view === k.id}
            collapsed={collapsed}
            badge={k.id === "invoice" ? "PRO" : undefined}
            onClick={() => onView(k.id)}
          />
        ))}
        {LOCKED_STUDIO.map((c) => (
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

      <div className="mt-4 space-y-1">
        {LIBRARY.map((c) => (
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

      {!collapsed && (
        <div className="mt-auto pt-4">
          <div className="rounded-2xl border bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Design Credits</span>
              <span className="text-muted-foreground">320 / 500</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-primary to-primary/60" />
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-xl">
              <Link to="/admin/billing">Upgrade Plan</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
