import { useMemo, useState } from "react";

type Props = {
  name: string;
  primary: string | null;
  gallery: string[];
  videoUrl: string | null;
};

type Slide = { kind: "image"; src: string } | { kind: "video"; embed: string };

function parseVideo(url: string | null): { embed: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return { embed: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { embed: `https://www.youtube.com/embed/${id}` };
    }
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      return {
        embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}

export function ProductGallery({ name, primary, gallery, videoUrl }: Props) {
  const slides = useMemo<Slide[]>(() => {
    const seen = new Set<string>();
    const imgs = [primary, ...gallery].filter((s): s is string => !!s && !seen.has(s) && (seen.add(s), true));
    const list: Slide[] = imgs.map((src) => ({ kind: "image", src }));
    const v = parseVideo(videoUrl);
    if (v) list.push({ kind: "video", embed: v.embed });
    return list;
  }, [primary, gallery, videoUrl]);

  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const current = slides[active];

  if (!current) {
    return (
      <div className="aspect-square grid place-items-center rounded-2xl border bg-muted text-sm text-muted-foreground">
        No image
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border bg-neutral-50"
        onMouseMove={(e) => {
          if (current.kind !== "image") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        {current.kind === "image" ? (
          <img
            src={current.src}
            alt={name}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={
              zoom
                ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                : undefined
            }
          />
        ) : (
          <iframe
            src={current.embed}
            title={`${name} video`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`sf-press h-16 w-16 shrink-0 overflow-hidden rounded-md border hover:border-sf-accent hover:opacity-100 ${i === active ? "ring-2 ring-sf-accent" : "opacity-80"}`}
              aria-label={s.kind === "video" ? "Play video" : `Image ${i + 1}`}
            >
              {s.kind === "image" ? (
                <img src={s.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 hover:scale-110" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-black text-[10px] font-semibold text-white">
                  ▶ Video
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
