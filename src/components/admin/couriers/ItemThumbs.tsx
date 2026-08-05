// Product thumbnails for courier order / parcel cards.
import { useState } from "react";
import { ImageOff } from "lucide-react";

export type ThumbItem = { name?: string | null; qty?: number | null; image?: string | null };

function Thumb({ item }: { item: ThumbItem }) {
  const [err, setErr] = useState(false);
  const src = item.image ?? null;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {src && !err ? (
        <img
          src={src}
          alt={item.name ?? "Product"}
          loading="lazy"
          decoding="async"
          onError={() => setErr(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <ImageOff className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {Number(item.qty ?? 1) > 1 && (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-foreground/80 px-1 text-[9px] font-semibold text-background">
          ×{item.qty}
        </span>
      )}
    </div>
  );
}

export function ItemThumbs({ items, max = 4 }: { items?: ThumbItem[] | null; max?: number }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <div className="flex items-center gap-1.5">
      {shown.map((it, i) => (
        <Thumb key={i} item={it} />
      ))}
      {rest > 0 && (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}
