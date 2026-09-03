// Offer builder — shared by the AI creation wizard and the Offer tab.
//
// It only edits the offer *intent*. Every price shown here is recalculated
// from the live catalog price of each product, and the server recalculates it
// again at order time, so display and charge can never drift apart.
import { useMemo } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  OFFER_TYPES,
  OFFER_TYPES_WITH_SECONDARY,
  computeTierPrice,
  defaultTiers,
  newTier,
  type LandingOffer,
  type OfferRole,
  type OfferType,
  type PriceBook,
} from "@/lib/landing-offer";
import { lpImage } from "@/lib/landing-builder";

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  primary_image_url?: string | null;
  stock?: number | null;
};

const ROLES: { v: OfferRole; label: string }[] = [
  { v: "addon", label: "Add-on" },
  { v: "gift", label: "Free gift" },
  { v: "upgrade", label: "Upgrade" },
];

export function OfferTypePicker({
  value,
  onChange,
}: {
  value: OfferType;
  onChange: (t: OfferType) => void;
}) {
  return (
    <div className="grid max-h-[45vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
      {OFFER_TYPES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-lg border p-2.5 text-left transition-colors hover:bg-accent ${
            value === t.id ? "border-primary bg-accent" : ""
          }`}
        >
          <div className="text-sm font-medium">{t.name}</div>
          <div className="text-[11px] text-muted-foreground">{t.desc}</div>
        </button>
      ))}
    </div>
  );
}

export function OfferBuilder({
  offer,
  onChange,
  mainProduct,
  catalog,
}: {
  offer: LandingOffer;
  onChange: (next: LandingOffer) => void;
  mainProduct: CatalogProduct;
  catalog: CatalogProduct[];
}) {
  const supportsSecondary = OFFER_TYPES_WITH_SECONDARY.includes(offer.type);

  const book: PriceBook = useMemo(
    () => ({
      main: { productId: mainProduct.id, name: mainProduct.name, price: Number(mainProduct.price) || 0 },
      others: Object.fromEntries(offer.products.map((p) => [p.productId, { name: p.name, price: p.price }])),
    }),
    [mainProduct, offer.products],
  );

  const set = (patch: Partial<LandingOffer>) => onChange({ ...offer, ...patch });

  function addProduct(p: CatalogProduct) {
    if (p.id === mainProduct.id || offer.products.some((x) => x.productId === p.id)) return;
    set({
      products: [
        ...offer.products,
        {
          productId: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          image: p.primary_image_url ?? "",
          role: offer.type === "bxgy" ? "gift" : offer.type === "premium" || offer.type === "upsell" ? "upgrade" : "addon",
        },
      ],
    });
  }

  function removeProduct(id: string) {
    set({
      products: offer.products.filter((p) => p.productId !== id),
      tiers: offer.tiers.map((t) => ({ ...t, items: t.items.filter((i) => i.productId !== id) })),
    });
  }

  function patchTier(index: number, patch: Partial<LandingOffer["tiers"][number]>) {
    set({ tiers: offer.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }

  function toggleTierItem(index: number, productId: string) {
    const tier = offer.tiers[index]!;
    const has = tier.items.some((i) => i.productId === productId);
    patchTier(index, {
      items: has
        ? tier.items.filter((i) => i.productId !== productId)
        : [...tier.items, { productId, qty: 1, free: offer.type === "bxgy" }],
    });
  }

  const available = catalog.filter(
    (p) => p.id !== mainProduct.id && !offer.products.some((x) => x.productId === p.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Show this offer on the page</div>
          <p className="text-[11px] text-muted-foreground">
            Off = the page sells the main product on its own.
          </p>
        </div>
        <Switch checked={offer.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Offer title</Label>
          <Input
            value={offer.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Choose your package"
          />
        </div>
        <div>
          <Label className="text-xs">Offer subtitle</Label>
          <Input
            value={offer.subtitle}
            onChange={(e) => set({ subtitle: e.target.value })}
            placeholder="Buy more, save more"
          />
        </div>
      </div>

      {supportsSecondary && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-sm font-medium">Secondary products</div>
          <p className="text-[11px] text-muted-foreground">
            Pick extra products from your catalog. Prices always come from the product itself.
          </p>

          <div className="space-y-1.5">
            {offer.products.map((p) => (
              <div key={p.productId} className="flex items-center gap-2 rounded-md border p-2">
                {p.image ? (
                  <img src={lpImage(p.image)} alt={p.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">৳{p.price}</div>
                </div>
                <select
                  className="h-8 rounded-md border bg-background px-1.5 text-xs"
                  value={p.role}
                  onChange={(e) =>
                    set({
                      products: offer.products.map((x) =>
                        x.productId === p.productId ? { ...x, role: e.target.value as OfferRole } : x,
                      ),
                    })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.v} value={r.v}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <Button size="icon" variant="ghost" onClick={() => removeProduct(p.productId)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {available.length > 0 && (
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value=""
              onChange={(e) => {
                const p = available.find((x) => x.id === e.target.value);
                if (p) addProduct(p);
              }}
            >
              <option value="">+ Add a product…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ৳{p.price}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Purchase options</div>
          <div className="flex gap-1.5">
            {offer.tiers.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => set({ tiers: defaultTiers(offer.type) })}>
                Suggest options
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => set({ tiers: [...offer.tiers, newTier(offer.tiers.length)] })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Option
            </Button>
          </div>
        </div>

        {offer.tiers.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Add at least one purchase option — for example 1 piece ৳999, 2 pieces ৳1,799.
          </p>
        )}

        {offer.tiers.map((tier, i) => {
          const priced = computeTierPrice(tier, book);
          return (
            <div key={tier.id} className="space-y-2 rounded-md border p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8"
                  value={tier.label}
                  onChange={(e) => patchTier(i, { label: e.target.value })}
                  placeholder={`Option ${i + 1} name`}
                />
                <Input
                  className="h-8 w-28"
                  value={tier.badge}
                  onChange={(e) => patchTier(i, { badge: e.target.value })}
                  placeholder="Badge"
                />
                <Button size="icon" variant="ghost" onClick={() => set({ tiers: offer.tiers.filter((_, x) => x !== i) })}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-[11px]">Main qty</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={1}
                    value={tier.quantity}
                    onChange={(e) => patchTier(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Pricing</Label>
                  <select
                    className="h-8 w-full rounded-md border bg-background px-1.5 text-xs"
                    value={tier.pricingMode}
                    onChange={(e) => patchTier(i, { pricingMode: e.target.value as any })}
                  >
                    <option value="none">Normal price</option>
                    <option value="fixed">Fixed offer price</option>
                    <option value="percent">% discount</option>
                    <option value="amount">৳ discount</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px]">Value</Label>
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    disabled={tier.pricingMode === "none"}
                    value={tier.value}
                    onChange={(e) => patchTier(i, { value: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={tier.featured} onCheckedChange={(v) => patchTier(i, { featured: v })} />
                  <span className="text-[11px] text-muted-foreground">Recommended</span>
                </div>
              </div>

              {supportsSecondary && offer.products.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Included extras</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.products.map((p) => {
                      const item = tier.items.find((x) => x.productId === p.productId);
                      return (
                        <div key={p.productId} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleTierItem(i, p.productId)}
                            className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                              item ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                            }`}
                          >
                            {p.name}
                          </button>
                          {item && (
                            <button
                              type="button"
                              onClick={() =>
                                patchTier(i, {
                                  items: tier.items.map((x) =>
                                    x.productId === p.productId ? { ...x, free: !x.free } : x,
                                  ),
                                })
                              }
                              className="rounded-full border px-2 py-1 text-[10px] text-muted-foreground"
                            >
                              {item.free ? "free" : "paid"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">
                  {priced.lines.map((l) => `${l.qty}× ${l.name}${l.free ? " (free)" : ""}`).join(" + ")}
                </span>
                <span className="font-medium">
                  {priced.savings > 0 && (
                    <span className="mr-1.5 text-muted-foreground line-through">৳{priced.original}</span>
                  )}
                  ৳{priced.price}
                  {priced.savings > 0 && (
                    <span className="ml-1.5 text-emerald-600">save ৳{priced.savings}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
