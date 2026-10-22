import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listMyStores, switchStore } from "@/lib/delegated-access.functions";
import { getActiveStoreId, setActiveStoreId } from "@/lib/active-store";
import { resolveStoreIcon } from "@/lib/store-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type Props = {
  currentStoreId: string | null;
  storeName: string;
  storeIcon: string | null;
  color?: string | null;
  roleLabel: string;
  compact?: boolean;
};

/** Sidebar store identity that doubles as the store switcher. */
export function StoreSwitcher({ currentStoreId, storeName, storeIcon, color, roleLabel, compact }: Props) {
  const list = useServerFn(listMyStores);
  const doSwitch = useServerFn(switchStore);
  const { data: stores = [] } = useQuery({ queryKey: ["access", "my-stores"], queryFn: () => list(), staleTime: 60_000 });

  async function choose(id: string, kind: string) {
    if (id === currentStoreId) return;
    try {
      const res = await doSwitch({ data: { storeId: kind === "owner" ? null : id } });
      setActiveStoreId(res.storeId);
      // Full reload: no cached data from the previous store can survive.
      window.location.assign("/admin");
    } catch (e) {
      setActiveStoreId(null);
      toast.error((e as Error).message);
    }
  }

  const mark = (name: string, icon: string | null, size = "h-8 w-8") => {
    // Stored logos may be storage paths, not directly usable image URLs.
    // Use the same resolver as the sidebar identity for every store row.
    const src = resolveStoreIcon({ logo_url: icon });
    return (
      <Avatar className={`${size} rounded-md border`}>
        {src && <AvatarImage src={src} alt={`${name} logo`} className="object-contain" />}
        <AvatarFallback className="rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {name.charAt(0).toUpperCase() || <Store className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label={`Store: ${storeName}`}
            title={storeName}
            className="flex items-center gap-1 rounded-lg border p-1 pr-1.5 transition hover:bg-muted"
          >
            {mark(storeName, storeIcon, "h-7 w-7")}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
        <Button variant="ghost" className="flex h-auto w-full justify-start gap-2.5 rounded-none border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
          <div className="min-w-0 flex-1 leading-tight">
            {resolveStoreIcon({ logo_url: storeIcon }) ? (
              <img
                src={resolveStoreIcon({ logo_url: storeIcon })!}
                alt={storeName}
                className="h-8 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <div className="truncate text-sm font-semibold">{storeName}</div>
            )}
            <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
          </div>
          {stores.length > 1 && <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {mark(storeName, storeIcon, "h-9 w-9")}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{storeName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">My Stores</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => choose(s.id, s.kind)} className="gap-2.5 py-2">
            {mark(s.name, s.logo, "h-7 w-7")}
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{s.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{s.role}</div>
            </div>
            {s.id === currentStoreId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {stores.length <= 1 && (
          <div className="px-2 py-2 text-[11px] text-muted-foreground">
            অন্য কোনো স্টোরে অ্যাক্সেস পেলে এখানে দেখাবে।
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Banner shown while working inside someone else's store. */
export function DelegatedStoreBanner({ storeName, roleLabel }: { storeName: string; roleLabel: string }) {
  const doSwitch = useServerFn(switchStore);
  if (!getActiveStoreId()) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <Store className="h-4 w-4 text-primary" />
      <span>
        আপনি <strong>{storeName}</strong>-এ কাজ করছেন · Access: <strong>{roleLabel}</strong>
      </span>
      <button
        className="ml-auto rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
        onClick={async () => {
          await doSwitch({ data: { storeId: null } }).catch(() => null);
          setActiveStoreId(null);
          window.location.assign("/admin");
        }}
      >
        My Store-এ ফিরুন
      </button>
    </div>
  );
}
