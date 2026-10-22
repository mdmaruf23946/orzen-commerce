import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

type Icon = React.ComponentType<{ className?: string }>;
type Child = { to: string; label: string; icon: Icon; search?: Record<string, unknown> };
type Item = { to: string; label: string; icon: Icon; children?: Child[] };
type Group = { label: string; items: Item[] };

/** Header search: jump to any merchant-panel page the user can access (Ctrl/⌘+K). */
export function AdminGlobalSearch({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sections = useMemo(
    () =>
      groups.map((g) => ({
        label: g.label,
        entries: g.items.flatMap((it) => {
          const own = { key: it.to, label: it.label, icon: it.icon, to: it.to, search: undefined as any, parent: "" };
          const kids = (it.children ?? []).map((c) => ({
            key: c.to + JSON.stringify(c.search ?? {}),
            label: c.label, icon: c.icon, to: c.to, search: c.search, parent: it.label,
          }));
          return it.children?.length ? kids : [own];
        }),
      })),
    [groups],
  );

  const go = (to: string, search?: Record<string, unknown>) => {
    setOpen(false);
    navigate({ to: to as any, search: search as any });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-full border bg-muted/40 py-2 pl-3 pr-2 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-background"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Search pages, orders, settings…</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium lg:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="কী খুঁজছেন? যেমন: orders, courier, payment…" />
        <CommandList>
          <CommandEmpty>কিছু পাওয়া যায়নি।</CommandEmpty>
          {sections.map((s) => (
            <CommandGroup key={s.label} heading={s.label}>
              {s.entries.map((e) => (
                <CommandItem
                  key={e.key}
                  value={`${e.label} ${e.parent} ${s.label} ${e.to}`}
                  onSelect={() => go(e.to, e.search)}
                  className="gap-2.5"
                >
                  <e.icon className="h-4 w-4 opacity-70" />
                  <span>{e.label}</span>
                  {e.parent && <span className="ml-auto text-xs text-muted-foreground">{e.parent}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
