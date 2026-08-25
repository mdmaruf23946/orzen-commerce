import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { getPublicReviews, REVIEWS_FALLBACK, type PlatformReview } from "@/lib/reviews.functions";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function ReviewCard({ r }: { r: PlatformReview }) {
  return (
    <article className="mx-2 w-[280px] shrink-0 rounded-2xl border border-[color:var(--orzen-border)] bg-white/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:w-[340px]">
      <div className="flex items-center gap-3">
        {r.avatar_url ? (
          <img
            src={r.avatar_url}
            alt={`${r.name} avatar`}
            loading="lazy"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
            style={{ boxShadow: `0 0 0 2px ${r.tone}33` }}
          />
        ) : (
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: r.tone }}
          >
            {initials(r.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[color:var(--orzen-navy)]">{r.name}</p>
          <p className="truncate text-xs text-[color:var(--orzen-muted)]">{r.store_name}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-0.5 text-[color:var(--orzen-warning)]">
        {Array.from({ length: 5 }).map((_, k) => (
          <Star
            key={k}
            className={k < r.rating ? "h-4 w-4 fill-current" : "h-4 w-4 opacity-25"}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--orzen-navy)]">{r.review}</p>
    </article>
  );
}

function Row({ items, reverse }: { items: PlatformReview[]; reverse?: boolean }) {
  const [held, setHeld] = useState(false);
  if (!items.length) return null;
  const loop = items.concat(items);
  return (
    <div
      className="group flex overflow-hidden py-2"
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
    >
      <div
        className="flex w-max animate-[orzen-marquee_46s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{
          ...(reverse ? { animationDirection: "reverse" as const } : null),
          ...(held ? { animationPlayState: "paused" as const } : null),
        }}
      >
        {loop.map((r, i) => (
          <ReviewCard key={`${r.id}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

export function TestimonialsMarquee() {
  const fetchReviews = useServerFn(getPublicReviews);
  const { data } = useQuery({
    queryKey: ["platform", "reviews"],
    queryFn: () => fetchReviews(),
    staleTime: 5 * 60 * 1000,
  });
  let list = ((data as PlatformReview[]) ?? REVIEWS_FALLBACK).filter(Boolean);
  if (!list.length) list = REVIEWS_FALLBACK;
  while (list.length < 4) list = list.concat(list);

  const half = Math.ceil(list.length / 2);
  const top = list.slice(0, half);
  const bottom = list.slice(half).length >= 2 ? list.slice(half) : list;

  return (
    <div className="relative mt-12">
      <Row items={top} />
      <Row items={bottom} reverse />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent sm:w-24" />
    </div>
  );
}
