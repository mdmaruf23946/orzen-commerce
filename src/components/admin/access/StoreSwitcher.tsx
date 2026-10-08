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

type Props = {
  currentStoreId: string | null;
  storeName: string;
  storeIcon: string | null;
  color?: string | null;
  roleLabel: string;
};

/** Sidebar store identity that doubles as the store switcher. */
export function StoreSwitcher({ currentStoreId, storeName, storeIcon, color, roleLabel }: Props) {
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

  const mark = (name: string, icon: string | null, c?: string | null, size = "h-8 w-8") =>
    icon ? (
      <img src={icon} alt="" className={`${size} shrink-0 rounded-md border object-cover`} />
    ) : (
      <div
        className={`grid ${size} shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground`}
        style={c ? { backgroundColor: c } : undefined}
      >
        {name.charAt(0).toUpperCase() || <Store className="h-4 w-4" />}
      </div>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
          {mark(storeName, storeIcon, color)}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">{storeName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
          </div>
          {stores.length > 1 && <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">My Stores</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => choose(s.id, s.kind)} className="gap-2.5 py-2">
            {mark(s.name, s.logo, s.color, "h-7 w-7")}
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
