// Responsive image gallery with a lightweight lightbox.
import { useState } from "react";
import { X } from "lucide-react";
import { lpImage } from "@/lib/landing-builder";

type Item = { image?: string; caption?: string };

export function Gallery({ title, items }: { title: string; items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const photos = items.filter((it) => String(it?.image ?? ""));
  if (!photos.length) return null;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              className="group overflow-hidden bg-neutral-100 lp-round-sm"
            >
              <img
                src={lpImage(String(it.image))}
                alt={String(it.caption ?? "")}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {String(it.caption ?? "") && (
                <span className="block px-2 py-1.5 text-center text-xs text-neutral-600">{it.caption}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {open !== null && photos[open] && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 text-white"
            onClick={() => setOpen(null)}
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={lpImage(String(photos[open].image))}
            alt={String(photos[open].caption ?? "")}
            className="max-h-[85vh] w-auto max-w-full object-contain"
          />
        </div>
      )}
    </section>
  );
}
