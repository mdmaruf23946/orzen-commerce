import { Star } from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";

/**
 * Real rating summary only. No fake breakdown bars and no "write a review"
 * CTA until review submission exists.
 */
export function ReviewsBlock({ rating, count = 0 }: { rating: number | null; count?: number }) {
  const { t } = useStoreT();
  const avg = rating ?? 0;
  const hasReviews = count > 0 && avg > 0;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{t("pdp.customerReviews")}</h2>
      <div className="mt-4 rounded-2xl border bg-white p-5">
        {hasReviews ? (
          <div className="flex items-center gap-4">
            <div className="text-4xl font-extrabold">{avg.toFixed(1)}</div>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${n <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pdp.basedOnReviews", { count: String(count) })}
              </p>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("pdp.noReviews")}</p>
        )}
      </div>
    </section>
  );
}
