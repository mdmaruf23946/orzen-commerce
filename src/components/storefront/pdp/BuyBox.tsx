import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  price: number;
  oldPrice: number | null;
  stock: number;
  status: string;
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  onBuy: () => void;
};

export function BuyBox({ price, oldPrice, stock, status, qty, setQty, onAdd, onBuy }: Props) {
  const inStock = stock > 0 && status !== "draft";
  const discountPct = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold" style={{ color: "var(--primary)" }}>
          ৳{price.toFixed(0)}
        </span>
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
          <span className="text-emerald-600">In stock ({stock})</span>
        ) : (
          <span className="text-destructive">Out of stock</span>
        )}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Qty</span>
        <div className="inline-flex items-center rounded-full border">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center"
            onClick={() => setQty(Math.min(stock || 1, qty + 1))}
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" disabled={!inStock} onClick={onAdd} className="h-12">
          Add to Cart
        </Button>
        <Button
          type="button"
          disabled={!inStock}
          onClick={onBuy}
          className="h-12"
          style={{ backgroundColor: "var(--primary)", color: "white" }}
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}
