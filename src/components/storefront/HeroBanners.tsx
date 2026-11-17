import { sizedImg, sizedSrcSet } from "@/lib/img-url";
import { useEffect, useRef, useState } from "react";
import { useStoreT } from "@/lib/storefront/store-i18n";
import { useStoreTheme } from "@/lib/theme/context";

export type HeroBanner = {
  id: string;
  image_url: string;
  link: string | null;
  display_position?: string | null;
};

function BannerLink({
  banner,
  children,
}: {
  banner: HeroBanner;
  children: React.ReactNode;
}) {
  if (!banner.link) return <>{children}</>;
  return (
    <a href={banner.link} target="_blank" rel="noreferrer" className="block h-full w-full">
      {children}
    </a>
  );
}

/** Auto-rotating index with pause support. */
function useAutoIndex(count: number, delay: number) {
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    setIdx(0);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const id = setInterval(() => {
      if (paused.current) return;
      // Don't repaint banners while the tab is hidden.
      if (typeof document !== "undefined" && document.hidden) return;
      setIdx((i) => (i + 1) % count);
    }, delay);
    return () => clearInterval(id);
  }, [count, delay]);

  return { idx, setIdx, paused };
}

/** Small auto-sliding stack used for the supporting banners. */
function SideRotator({ items, delay }: { items: HeroBanner[]; delay: number }) {
  const { idx, paused } = useAutoIndex(items.length, delay);

  return (
    <div
      className="h-full w-full overflow-hidden"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {items.map((b) => (
          <div key={b.id} className="h-full w-full flex-shrink-0">
            <BannerLink banner={b}>
              <img
                src={sizedImg(b.image_url, 640)}
                srcSet={sizedSrcSet(b.image_url, [480, 640, 960])}
                sizes="(min-width:1024px) 33vw, 100vw"
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full select-none object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
              />
            </BannerLink>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hero-first banner layout: every banner marked as "hero" stays in the large
 * top slot and auto-rotates. All other banners fall to the supporting column
 * and auto-rotate there too.
 */
export function HeroBanners({ banners }: { banners: HeroBanner[] }) {
  const { t } = useStoreT();
  const layout = useStoreTheme().banner?.layout ?? "split_right";

  const heroes = banners.filter((b) => (b.display_position ?? "hero") === "hero");
  const rest = banners.filter((b) => (b.display_position ?? "hero") !== "hero");
  // Fallback: no explicit hero -> promote the first banner.
  const main = heroes.length > 0 ? heroes : banners.slice(0, 1);
  const others = heroes.length > 0 ? rest : banners.slice(1);

  const { idx, setIdx, paused } = useAutoIndex(main.length, 4500);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);

  function onDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    deltaX.current = 0;
    paused.current = true;
  }
  function onMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    deltaX.current = e.clientX - startX.current;
  }
  function onUp() {
    if (startX.current == null) return;
    const d = deltaX.current;
    startX.current = null;
    paused.current = false;
    if (Math.abs(d) < 40 || main.length < 2) return;
    setIdx((i) => (d < 0 ? (i + 1) % main.length : (i - 1 + main.length) % main.length));
  }

  // Split the supporting banners across two slots so each one keeps sliding.
  const slotA = others.filter((_, i) => i % 2 === 0);
  const slotB = others.filter((_, i) => i % 2 === 1);
  // Slots are fixed: left slot always slot A, right slot always slot B. An
  // empty slot keeps its space so a single banner never grows or moves.
  const slots = [slotA, slotB];
  const hasSide = others.length > 0;

  if (main.length === 0) return null;

  const mainShape =
    layout === "strip" ? "aspect-[24/5] rounded-xl" : layout === "full" ? "aspect-[12/5] lg:aspect-[16/5] rounded-none" : "aspect-[12/5] rounded-xl sm:rounded-2xl";
  const mainEl = (
    <>
      {/* Main hero banner — fixed 12:5 (e.g. 1920×800) on every screen size so the
          merchant's required upload size shows uncropped on mobile and desktop. */}
      <div
        className={`relative w-full min-w-0 max-w-full overflow-hidden bg-sf-surface ${mainShape}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
      >
        <div
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {main.map((b, i) => (
            <div key={b.id} className="h-full w-full flex-shrink-0">
              <BannerLink banner={b}>
                <img
                  src={sizedImg(b.image_url, 960)}
                  srcSet={sizedSrcSet(b.image_url, [480, 640, 960, 1280, 1920])}
                  sizes="(min-width:1024px) 66vw, 100vw"
                  alt=""
                  draggable={false}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  className="h-full w-full select-none object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03]"
                />
              </BannerLink>
            </div>
          ))}
        </div>


        {main.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {main.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={t("home.banner", { n: i + 1 })}
                className={`h-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white ${
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

    </>
  );
  const slotBox = (items: HeroBanner[], i: number, cls: string) =>
    items.length > 0 ? (
      <div key={i} className={`min-h-0 overflow-hidden rounded-xl bg-sf-surface sm:rounded-2xl ${cls}`}>
        <SideRotator items={items} delay={5200 + i * 900} />
      </div>
    ) : (
      <div key={i} aria-hidden className={`min-h-0 rounded-xl bg-sf-surface/40 sm:rounded-2xl ${cls}`} />
    );

  if (layout === "trio") {
    const all = [main, slotA, slotB];
    return (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Promotions">
        {all.map((items, i) => slotBox(items, i, "aspect-[4/3]"))}
      </section>
    );
  }
  if (layout === "full" || layout === "strip") {
    return (
      <section className={layout === "full" ? "-mx-3 space-y-3 sm:-mx-6" : "space-y-3"} aria-label="Promotions">
        {mainEl}
        {hasSide && layout === "full" && (
          <div className="grid grid-cols-2 gap-3 px-3 sm:px-6">{slots.map((items, i) => slotBox(items, i, "aspect-[8/3]"))}</div>
        )}
      </section>
    );
  }
  if (layout === "stacked") {
    return (
      <section className="space-y-3" aria-label="Promotions">
        {mainEl}
        {hasSide && <div className="grid grid-cols-2 gap-3">{slots.map((items, i) => slotBox(items, i, "aspect-[8/3]"))}</div>}
      </section>
    );
  }
  const left = layout === "split_left";
  return (
    <section
      className={`grid grid-cols-1 items-stretch gap-3 ${hasSide ? (left ? "lg:grid-cols-[1fr_3fr]" : "lg:grid-cols-[3fr_1fr]") : ""}`}
      aria-label="Promotions"
    >
      <div className={left ? "lg:order-2" : ""}>{mainEl}</div>
      {hasSide && (
        <div className={`relative min-w-0 ${left ? "lg:order-1" : ""}`}>
          {/* Locked to the main banner's height: no image size can stretch this column. */}
          <div className="grid grid-cols-2 gap-3 lg:absolute lg:inset-0 lg:grid-cols-1 lg:grid-rows-2">
            {slots.map((items, i) => slotBox(items, i, "aspect-[8/5] lg:aspect-auto lg:h-full"))}
          </div>
        </div>
      )}
    </section>
  );
}
