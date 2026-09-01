import { Minus, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStockless } from "@/lib/product-stock";
import { useStoreT } from "@/lib/store-i18n";

type Props = {
  price: number;
  oldPrice: number | null;
  stock: number;
  status: string;
  productType?: string | null;
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  onBuy: () => void;
  whatsapp?: string | null;
  productName?: string;
};

export function BuyBox({
  price,
  oldPrice,
  stock,
  status,
  productType,
  qty,
  setQty,
  onAdd,
  onBuy,
  whatsapp,
  productName,
}: Props) {
  const { t } = useStoreT();
  const stockless = isStockless(productType);
  const inStock = status !== "draft" && (stockless || stock > 0);
  const discountPct = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const waDigits = (whatsapp ?? "").replace(/\D/g, "");
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Hi! I want to order:\n${productName ?? ""}\nPrice: ৳${price.toFixed(0)}\n${pageUrl}`,
      )}`
    : null;

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold tracking-tight text-sf-accent">৳{price.toFixed(0)}</span>
        {oldPrice && oldPrice > price && (
          <>
            <span className="text-sm text-muted-foreground line-through">৳{oldPrice.toFixed(0)}</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">
              −{discountPct}%
            </span>
          </>
        )}
      </div>

      <p className="mt-1 text-sm">
        {inStock ? (
          <span className="text-emerald-600">{stockless ? "Available" : `In stock (${stock})`}</span>
        ) : (
          <span className="text-destructive">Out of stock</span>
        )}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Qty</span>
        <div className="inline-flex items-center rounded-full border">
          <button
            type="button"
            className="sf-press grid h-10 w-10 place-items-center rounded-full hover:bg-sf-accent-soft hover:text-sf-accent"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            className="sf-press grid h-10 w-10 place-items-center rounded-full hover:bg-sf-accent-soft hover:text-sf-accent"
            onClick={() => setQty(stockless ? qty + 1 : Math.min(stock || 1, qty + 1))}
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!inStock}
          onClick={onAdd}
          className="sf-press h-12 border-2 border-sf-accent font-semibold text-sf-accent hover:bg-sf-accent/10 hover:text-sf-accent"
        >
          {t("pdp.addToCart")}
        </Button>
        <Button
          type="button"
          disabled={!inStock}
          onClick={onBuy}
          className="sf-press h-12 bg-sf-accent font-semibold text-white shadow-sm hover:bg-sf-accent-hover hover:shadow-[0_12px_26px_-14px_var(--sf-accent)]"
        >
          {t("pdp.buyNow")}
        </Button>
      </div>

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 sf-press rounded-md bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 hover:shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          Order via WhatsApp
        </a>
      )}
    </div>
  );
}
