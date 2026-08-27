import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listProductReviews, submitProductReview } from "@/lib/storefront.functions";
import { useStoreT } from "@/lib/store-i18n";

type Props = {
  rating?: number | null;
  count?: number;
  storeId?: string;
  productId?: string;
};

export function ReviewsBlock({ rating, count = 0, storeId, productId }: Props) {
  const { t } = useStoreT();
  const enabled = Boolean(storeId && productId);

  const reviewsQ = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => listProductReviews({ data: { productId: productId! } }),
    enabled,
    staleTime: 60_000,
  });

  const list = reviewsQ.data?.reviews ?? [];
  const avg = reviewsQ.data?.average || rating || 0;
  const total = reviewsQ.data?.count || count || 0;
  const hasReviews = total > 0 && avg > 0;

  const [form, setForm] = useState({ rating: 5, name: "", email: "", phone: "", comment: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled) return;
    if (!form.name.trim() || !form.comment.trim()) {
      toast.error("Please add your name and comment");
      return;
    }
    setSaving(true);
    try {
      const res = await submitProductReview({
        data: {
          storeId: storeId!,
          productId: productId!,
          rating: form.rating,
          name: form.name.trim(),
          comment: form.comment.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Failed");
      toast.success("Thanks! Your review will appear once approved.");
      setForm({ rating: 5, name: "", email: "", phone: "", comment: "" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not submit review");
    } finally {
      setSaving(false);
    }
  }

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
                {t("pdp.basedOnReviews", { count: String(total) })}
              </p>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("pdp.noReviews")}</p>
        )}

        {list.length > 0 && (
          <ul className="mt-5 space-y-4 border-t pt-5">
            {list.map((r) => (
              <li key={r.id} className="rounded-xl border bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
                    />
                  ))}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{r.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {enabled && (
        <form onSubmit={submit} className="mt-4 rounded-2xl border bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Write a Review</h3>

          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star`}
                onClick={() => setForm((f) => ({ ...f, rating: n }))}
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    n <= form.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Input
              required
              maxLength={100}
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              type="email"
              maxLength={255}
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              maxLength={30}
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>

          <Textarea
            required
            maxLength={2000}
            rows={4}
            placeholder="Share your experience with this product"
            className="mt-3"
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          />

          <Button
            type="submit"
            disabled={saving}
            className="mt-3 h-11 bg-sf-accent font-semibold text-white hover:bg-sf-accent-hover"
          >
            {saving ? "Submitting…" : "Submit Review"}
          </Button>
        </form>
      )}
    </section>
  );
}
