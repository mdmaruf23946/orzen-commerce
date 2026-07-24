import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReviewsBlock({ rating }: { rating: number | null }) {
  const avg = rating ?? 0;
  const breakdown = [5, 4, 3, 2, 1].map((s) => ({ stars: s, pct: 0 }));

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Customer Reviews</h2>
      <div className="mt-4 grid gap-6 rounded-2xl border bg-white p-5 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center justify-center border-b pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
          <div className="text-4xl font-extrabold">{avg.toFixed(1)}</div>
          <div className="mt-1 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">No reviews yet</p>
        </div>
        <div className="space-y-2">
          {breakdown.map((b) => (
            <div key={b.stars} className="flex items-center gap-3 text-xs">
              <span className="w-6 text-muted-foreground">{b.stars}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full bg-amber-400" style={{ width: `${b.pct}%` }} />
              </div>
              <span className="w-8 text-right text-muted-foreground">{b.pct}%</span>
            </div>
          ))}
          <div className="pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast("Reviews are opening soon", { description: "Be the first — check back shortly." })}
            >
              Write a Review
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
