// Shows what changed when the local cart is reconciled with live product data.
import { AlertCircle } from "lucide-react";
import type { CartNotice } from "@/lib/cart-reconcile";
import { useStoreT } from "@/lib/store-i18n";

export function CartNotices({ notices }: { notices: CartNotice[] }) {
  const { t } = useStoreT();
  if (!notices.length) return null;
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertCircle className="h-4 w-4" />
        {t("cart.updated.title")}
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {notices.map((n, idx) => (
          <li key={`${n.productId}-${idx}`}>
            {n.kind === "price"
              ? t("cart.updated.price", { name: n.name, from: n.from.toFixed(0), to: n.to.toFixed(0) })
              : n.kind === "stock"
                ? t("cart.updated.stock", { name: n.name, to: n.to })
                : t("cart.updated.removed", { name: n.name })}
          </li>
        ))}
      </ul>
    </div>
  );
}
