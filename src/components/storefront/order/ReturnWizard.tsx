// Customer return / exchange wizard.
// Step 1 pick items + quantities, step 2 pick the outcome (refund, same product
// with another variant, or a different product), step 3 reason + photos.
// Money is previewed with the same calculator the server re-runs on submit.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, Package, Search, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getReturnContext, createMyReturnRequest } from "@/lib/returns.functions";
import { readWishlist } from "@/lib/wishlist";
import {
  computeReturnAmounts,
  KIND_LABEL,
  type ReturnKind,
  type ReturnLine,
} from "@/lib/returns-pricing";

function img(p?: string | null) {
  if (!p) return null;
  const raw = p.trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

const bdt = (n: number) => `৳${Number(n || 0).toFixed(0)}`;

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export function ReturnWizard({
  slug,
  token,
  orderId,
  initialKind = "return",
  onClose,
  onDone,
}: {
  slug: string;
  token: string;
  orderId: string;
  initialKind?: ReturnKind;
  onClose: () => void;
  onDone?: () => void;
}) {
  const ctxFn = useServerFn(getReturnContext);
  const createFn = useServerFn(createMyReturnRequest);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["return-context", orderId, token],
    queryFn: () => ctxFn({ data: { storeSlug: slug, token, orderId } }),
  });

  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [variantByItem, setVariantByItem] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<ReturnKind>(initialKind);
  const [pickedProduct, setPickedProduct] = useState<any | null>(null);
  const [pickedVariant, setPickedVariant] = useState<string>("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const policy = (ctx as any)?.policy;
  const lines: any[] = (ctx as any)?.lines ?? [];

  const selected: ReturnLine[] = useMemo(
    () =>
      lines
        .filter((l) => (qty[l.order_item_id] ?? 0) > 0)
        .map((l) => ({
          order_item_id: l.order_item_id,
          product_id: l.product_id,
          name: l.name,
          variant: variantByItem[l.order_item_id] || null,
          qty: qty[l.order_item_id] ?? 0,
          price: l.price,
          image_url: l.image_url,
        })),
    [lines, qty, variantByItem],
  );

  const replacements: ReturnLine[] = useMemo(() => {
    if (kind === "return") return [];
    if (kind === "exchange_same") {
      return selected.map((s) => {
        const src = lines.find((l) => l.order_item_id === s.order_item_id);
        const v = (src?.variants ?? []).find((x: any) => x.label === variantByItem[`new:${s.order_item_id}`]);
        return {
          product_id: s.product_id,
          name: s.name,
          variant: variantByItem[`new:${s.order_item_id}`] || null,
          qty: s.qty,
          price: Number(v?.price ?? s.price),
          image_url: s.image_url,
        };
      });
    }
    if (!pickedProduct) return [];
    const v = (pickedProduct.variants ?? []).find((x: any) => x.label === pickedVariant);
    const totalQty = selected.reduce((s, l) => s + l.qty, 0) || 1;
    return [
      {
        product_id: pickedProduct.id,
        name: pickedProduct.name,
        variant: pickedVariant || null,
        qty: totalQty,
        price: Number(v?.price ?? pickedProduct.price),
        image_url: pickedProduct.image_url,
      },
    ];
  }, [kind, selected, lines, variantByItem, pickedProduct, pickedVariant]);

  const amounts = useMemo(
    () => (policy ? computeReturnAmounts(policy, kind, selected, replacements) : null),
    [policy, kind, selected, replacements],
  );

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, 4 - images.length)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        next.push(await toDataUrl(await compressImage(f)));
      } catch {
        /* skip */
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, 4));
  }

  async function submit() {
    if (selected.length === 0) return toast.error("Select at least one item");
    if (reason.trim().length < 3) return toast.error("Please describe the reason");
    if (kind !== "return" && replacements.length === 0)
      return toast.error("Choose the replacement item");
    setBusy(true);
    try {
      await createFn({
        data: {
          storeSlug: slug,
          token,
          orderId,
          kind,
          reason: reason.trim(),
          note: note.trim() || undefined,
          lines: selected as any,
          replacements: replacements as any,
          images,
        },
      });
      toast.success("Request submitted");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kinds: ReturnKind[] = [
    ...(policy?.allow_return ? (["return"] as ReturnKind[]) : []),
    ...(policy?.allow_exchange_same && policy?.exchange_rules?.different_variant !== false
      ? (["exchange_same"] as ReturnKind[])
      : []),
    ...(policy?.allow_exchange_other && policy?.exchange_rules?.different_product !== false
      ? (["exchange_other"] as ReturnKind[])
      : []),
  ];


  const wishlistIds = useMemo(
    () =>
      policy?.replacement_source === "wishlist"
        ? new Set(readWishlist(slug).map((w) => w.productId))
        : null,
    [policy?.replacement_source, slug],
  );

  const catalogue: any[] = ((ctx as any)?.catalogue ?? [])
    .filter((p: any) => (wishlistIds ? wishlistIds.has(p.id) : true))
    .filter((p: any) =>
      search.trim() ? p.name.toLowerCase().includes(search.trim().toLowerCase()) : true,
    );


  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return or exchange</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!isLoading && ctx && !(ctx as any).eligible && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This order is not eligible for a return right now
            {(ctx as any).windowEndsAt
              ? ` — the window closed on ${new Date((ctx as any).windowEndsAt).toLocaleDateString()}.`
              : "."}
          </p>
        )}

        {!isLoading && ctx && (ctx as any).eligible && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-muted"}`}
                />
              ))}
            </div>

            {/* STEP 1 — items */}
            {step === 0 && (
              <div className="space-y-3">
                <Label>Which items?</Label>
                {lines.map((l) => {
                  const max = l.returnable_qty;
                  const cur = qty[l.order_item_id] ?? 0;
                  return (
                    <div key={l.order_item_id} className="rounded-lg border p-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                          {img(l.image_url) ? (
                            <img src={img(l.image_url)!} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {bdt(l.price)} · {max} of {l.qty} returnable
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={cur <= 0}
                            onClick={() => setQty((p) => ({ ...p, [l.order_item_id]: Math.max(0, cur - 1) }))}
                            className="h-7 w-7 rounded-md border disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums">{cur}</span>
                          <button
                            type="button"
                            disabled={cur >= max}
                            onClick={() => setQty((p) => ({ ...p, [l.order_item_id]: Math.min(max, cur + 1) }))}
                            className="h-7 w-7 rounded-md border disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 2 — outcome */}
            {step === 1 && (
              <div className="space-y-3">
                <Label>What would you like?</Label>
                <div className="grid gap-2">
                  {kinds.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                        kind === k ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>

                {kind === "exchange_same" && (
                  <div className="space-y-2">
                    <Label>Pick the replacement variant</Label>
                    {selected.map((s) => {
                      const src = lines.find((l) => l.order_item_id === s.order_item_id);
                      const opts = (src?.variants ?? []) as any[];
                      return (
                        <div key={s.order_item_id} className="rounded-lg border p-2.5">
                          <p className="truncate text-sm font-medium">{s.name}</p>
                          {opts.length === 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              No variants — the same item will be reshipped.
                            </p>
                          ) : (
                            <select
                              value={variantByItem[`new:${s.order_item_id}`] ?? ""}
                              onChange={(e) =>
                                setVariantByItem((p) => ({
                                  ...p,
                                  [`new:${s.order_item_id}`]: e.target.value,
                                }))
                              }
                              className="mt-1.5 h-9 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="">Same as ordered</option>
                              {opts
                                .filter((o) => o.stock > 0)
                                .map((o) => (
                                  <option key={o.label} value={o.label}>
                                    {o.label} — {bdt(o.price)}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {kind === "exchange_other" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search in-stock products"
                        className="pl-8"
                      />
                    </div>
                    <div className="max-h-56 space-y-1.5 overflow-y-auto">
                      {catalogue.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPickedProduct(p);
                            setPickedVariant("");
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left ${
                            pickedProduct?.id === p.id ? "border-foreground" : ""
                          }`}
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                            {img(p.image_url) ? (
                              <img src={img(p.image_url)!} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {bdt(p.price)} · {p.stock} in stock
                            </span>
                          </span>
                        </button>
                      ))}
                      {catalogue.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No products available.
                        </p>
                      )}
                    </div>
                    {pickedProduct && (pickedProduct.variants ?? []).length > 0 && (
                      <select
                        value={pickedVariant}
                        onChange={(e) => setPickedVariant(e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="">Choose a variant</option>
                        {pickedProduct.variants
                          .filter((o: any) => o.stock > 0)
                          .map((o: any) => (
                            <option key={o.label} value={o.label}>
                              {o.label} — {bdt(o.price)}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}

                {amounts && <AmountPreview a={amounts} kind={kind} />}
              </div>
            )}

            {/* STEP 3 — reason + photos */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tell us what went wrong"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Additional note (optional)</Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Photos (optional, up to 4)</Label>
                  <Input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {images.map((src, i) => (
                        <div key={i} className="relative">
                          <img src={src} alt="" className="h-16 w-16 rounded-md border object-cover" />
                          <button
                            type="button"
                            onClick={() => setImages((p) => p.filter((_, x) => x !== i))}
                            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border bg-background"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {amounts && <AmountPreview a={amounts} kind={kind} />}
                {policy?.policy_note && (
                  <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                    {policy.policy_note}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {step > 0 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  className="flex-1"
                  disabled={step === 0 && selected.length === 0}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button className="flex-1" disabled={busy} onClick={submit}>
                  {busy ? "Submitting…" : "Submit request"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AmountPreview({ a, kind }: { a: any; kind: ReturnKind }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      <Row label="Returned items" value={bdt(a.items_value)} />
      {kind !== "return" && <Row label="Replacement value" value={`− ${bdt(a.replacement_value)}`} />}
      {a.return_shipping_charge > 0 && (
        <Row label="Return shipping" value={`− ${bdt(a.return_shipping_charge)}`} />
      )}
      {a.replacement_shipping_charge > 0 && (
        <Row label="Replacement shipping" value={`− ${bdt(a.replacement_shipping_charge)}`} />
      )}
      {a.restocking_fee > 0 && <Row label="Restocking fee" value={`− ${bdt(a.restocking_fee)}`} />}
      <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
        <span>{a.extra_payment_due > 0 ? "You pay" : "Refund to you"}</span>
        <span>{bdt(a.extra_payment_due > 0 ? a.extra_payment_due : a.refund_amount)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
