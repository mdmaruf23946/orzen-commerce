import { useEffect, useState, type RefObject } from "react";
import { useStoreT } from "@/lib/store-i18n";

export function StickyMobileBar({
  price,
  disabled,
  onAdd,
  onBuy,
  observeRef,
}: {
  price: number;
  disabled: boolean;
  onAdd: () => void;
  onBuy: () => void;
  observeRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useStoreT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = observeRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [observeRef]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-3 py-2 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur transition-transform lg:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 pr-1">
          <p className="text-[10px] text-muted-foreground">Price</p>
          <p className="text-base font-extrabold leading-none text-sf-accent">
            ৳{price.toFixed(0)}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="h-11 flex-1 rounded-full border-2 border-sf-accent bg-white text-sm font-semibold text-sf-accent hover:bg-sf-accent/10 disabled:opacity-50"
        >
          {t("pdp.addToCart")}
        </button>
        <button
          type="button"
          onClick={onBuy}
          disabled={disabled}
          className="h-11 flex-1 rounded-full bg-sf-accent text-sm font-semibold text-white shadow-sm hover:bg-sf-accent-hover disabled:opacity-50"
        >
          {t("pdp.buyNow")}
        </button>
      </div>
    </div>
  );
}
