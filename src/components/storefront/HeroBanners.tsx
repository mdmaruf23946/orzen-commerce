import { useEffect, useRef, useState } from "react";
import { useStoreT } from "@/lib/store-i18n";

export type HeroBanner = { id: string; image_url: string; link: string | null };

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

/**
 * Double-banner hero: one large rotating main banner plus up to two
 * supporting promo banners. Falls back cleanly with 1 or 2 banners.
 */
export function HeroBanners({ banners }: { banners: HeroBanner[] }) {
  const { t } = useStoreT();
  const main = banners.length > 3 ? banners.slice(0, banners.length - 2) : banners.slice(0, 1);
  const side = banners.length > 3 ? banners.slice(-2) : banners.slice(1, 3);

  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    if (main.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!paused.current) setIdx((i) => (i + 1) % main.length);
    }, 4500);
    return () => clearInterval(id);
  }, [main.length]);

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

  const hasSide = side.length > 0;

  return (
    <section
      className={`grid gap-3 ${hasSide ? "lg:grid-cols-[1.85fr_1fr]" : ""}`}
      aria-label="Promotions"
    >
      {/* Main banner */}
      <div
        className="relative -mx-4 overflow-hidden bg-sf-surface sm:mx-0 sm:rounded-2xl"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {main.map((b, i) => (
            <div key={b.id} className="w-full flex-shrink-0">
              <BannerLink banner={b}>
                <img
                  src={b.image_url}
                  alt=""
                  draggable={false}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  className={`w-full select-none object-cover ${
                    hasSide
                      ? "aspect-[16/9] sm:aspect-[16/8] lg:aspect-[16/9]"
                      : "aspect-[16/9] sm:aspect-[16/6] lg:aspect-[16/5]"
                  }`}
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
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Supporting banners */}
      {hasSide && (
        <div
          className={`grid gap-3 ${side.length > 1 ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-1"}`}
        >
          {side.map((b) => (
            <div
              key={b.id}
              className="overflow-hidden rounded-2xl bg-sf-surface"
            >
              <BannerLink banner={b}>
                <img
                  src={b.image_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/10] w-full object-cover transition-transform duration-500 hover:scale-[1.03] lg:aspect-[16/9]"
                />
              </BannerLink>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
