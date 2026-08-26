import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2, Check } from "lucide-react";
import { readCart, updateQty, removeItem, readSelection, writeSelection, type CartItem } from "@/lib/cart";
import { getStoreBySlug, listProductsByIds } from "@/lib/storefront.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/$slug/cart")({
  head: () => ({ meta: [{ title: "Cart" }] }),
  component: CartPage,
});

type PType = "physical" | "digital" | "service" | "subscription";

const TYPE_LABEL: Record<PType, string> = {
  physical: "Physical products",
  digital: "Digital products",
  service: "Services",
  subscription: "Subscriptions",
};

const TYPE_NOTE: Record<PType, string> = {
  physical: "Delivered to your address",
  digital: "Instant download after payment",
  service: "Booked with schedule & requirements",
  subscription: "Recurring billing plan",
};

const ORDER: PType[] = ["physical", "digital", "service", "subscription"];

function CartPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const getStore = useServerFn(getStoreBySlug);
  const listByIds = useServerFn(listProductsByIds);

  useEffect(() => {
    const update = () => setItems(readCart(slug));
    update();
    setSelected(readSelection(slug));
    window.addEventListener("cart-changed", update);
    return () => window.removeEventListener("cart-changed", update);
  }, [slug]);

  const { data: store } = useQuery({
    queryKey: ["store", slug],
    queryFn: () => getStore({ data: { slug } }),
  });

  const ids = items.map((i) => i.productId);
  const { data: products = [] } = useQuery({
    enabled: !!store?.id && ids.length > 0,
    queryKey: ["cartProducts", store?.id, ids.join(",")],
    queryFn: () => listByIds({ data: { storeId: store!.id, ids } }),
  });

  const typeOf = useMemo(() => {
    const map: Record<string, PType> = {};
    for (const p of products as any[]) map[p.id] = (p.product_type ?? "physical") as PType;
    return map;
  }, [products]);

  const groups = useMemo(() => {
    const g: Record<string, CartItem[]> = {};
    for (const i of items) {
      const t = typeOf[i.productId] ?? "physical";
      (g[t] ??= []).push(i);
    }
    return ORDER.filter((t) => g[t]?.length).map((t) => ({ type: t, items: g[t] }));
  }, [items, typeOf]);

  // Selection is always confined to a single product type.
  const activeType: PType | null = selected.length
    ? (typeOf[selected[0]] ?? null)
    : null;

  function persist(next: string[]) {
    setSelected(next);
    writeSelection(slug, next);
  }

  function toggleItem(id: string) {
    const t = typeOf[id] ?? "physical";
    if (activeType && t !== activeType) {
      // Switching type resets the selection to the new type only.
      persist([id]);
      return;
    }
    persist(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function toggleGroup(type: PType, groupItems: CartItem[]) {
    const gIds = groupItems.map((i) => i.productId);
    const allOn = activeType === type && gIds.every((id) => selected.includes(id));
    persist(allOn ? [] : gIds);
  }

  // Drop selected ids that are no longer in the cart.
  useEffect(() => {
    if (!selected.length) return;
    const live = selected.filter((id) => ids.includes(id));
    if (live.length !== selected.length) persist(live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const selectedItems = items.filter((i) => selected.includes(i.productId));
  const total = selectedItems.reduce((a, i) => a + i.qty * i.price, 0);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">{t("cart.empty")}</h1>
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          {"\u2190 "}{t("cart.continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-xl font-semibold">Your cart</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Select one product type to check out. Each type has its own order process.
        </p>
      </div>

      {groups.map(({ type, items: gItems }) => {
        const gIds = gItems.map((i) => i.productId);
        const groupActive = activeType === null || activeType === type;
        const allOn = activeType === type && gIds.every((id) => selected.includes(id));
        return (
          <section
            key={type}
            className={`overflow-hidden rounded-xl border bg-card transition-opacity ${groupActive ? "" : "opacity-50"}`}
          >
            <header className="flex items-center gap-3 border-b bg-muted/40 p-3">
              <Box checked={allOn} onClick={() => toggleGroup(type, gItems)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{TYPE_LABEL[type]}</p>
                <p className="text-[11px] text-muted-foreground">{TYPE_NOTE[type]}</p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
                {gItems.length}
              </span>
            </header>
            <ul className="divide-y">
              {gItems.map((i) => {
                const on = selected.includes(i.productId);
                return (
                  <li key={i.productId} className="flex gap-3 p-3">
                    <Box checked={on} onClick={() => toggleItem(i.productId)} className="mt-6" />
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium">{i.name}</p>
                        <button
                          onClick={() => removeItem(slug, i.productId)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border">
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center"
                            onClick={() => updateQty(slug, i.productId, i.qty - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm">{i.qty}</span>
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center"
                            onClick={() => updateQty(slug, i.productId, i.qty + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold">৳{(i.qty * i.price).toFixed(0)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">
          Subtotal {selectedItems.length ? `(${selectedItems.length} selected)` : ""}
        </span>
        <span className="text-lg font-bold">৳{total.toFixed(0)}</span>
      </div>
      {!selected.length && (
        <p className="text-xs text-muted-foreground">
          Tick the products of one type to continue.
        </p>
      )}
      <Button
        className="h-12 w-full"
        disabled={!selected.length}
        style={{ backgroundColor: "var(--primary)", color: "white" }}
        onClick={() => navigate({ to: "/store/$slug/checkout", params: { slug } })}
      >
        {activeType ? `Checkout ${TYPE_LABEL[activeType].toLowerCase()}` : "Checkout"}
      </Button>
    </div>
  );
}

function Box({
  checked,
  onClick,
  className = "",
}: {
  checked: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
      } ${className}`}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}
