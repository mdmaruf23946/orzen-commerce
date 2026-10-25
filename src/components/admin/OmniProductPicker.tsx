import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Package, Search, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchOmniProducts, sendOmniProduct } from "@/lib/omni-products.functions";
import { optionLabelBn, parseVariants, selectedVariant } from "@/lib/messenger-variants";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; conversationId: string; onSent: () => void };

export function OmniProductPicker({ open, onOpenChange, conversationId, onSent }: Props) {
  const search = useServerFn(searchOmniProducts);
  const send = useServerFn(sendOmniProduct);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<any>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) {
      setPicked(null);
      setSel({});
      setQ("");
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["omni-products", debounced],
    queryFn: () => search({ data: { q: debounced || undefined } }),
    enabled: open,
    staleTime: 30_000,
  });
  const rows = (data?.rows ?? []) as any[];

  const variants = useMemo(() => (picked ? parseVariants(picked.variants) : { options: [], items: [] }), [picked]);
  const chosen = picked && Object.keys(sel).length ? selectedVariant(picked.variants, sel) : null;
  const allChosen = variants.options.every((o) => sel[o.name]);

  function available(name: string, value: string) {
    if (!variants.items.length) return true;
    const want = { ...sel, [name]: value };
    return variants.items.some(
      (i) => Object.entries(want).every(([k, v]) => String(i.options?.[k] ?? "") === v) && (i.stock == null || i.stock > 0),
    );
  }

  async function doSend(product: any, variant?: Record<string, string>) {
    setSending(true);
    try {
      await send({ data: { conversationId, productId: product.id, variant } });
      toast.success("প্রোডাক্ট পাঠানো হয়েছে");
      onSent();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "পাঠানো যায়নি");
      onSent();
    } finally {
      setSending(false);
    }
  }

  function choose(p: any) {
    if (parseVariants(p.variants).options.length) {
      setPicked(p);
      setSel({});
    } else void doSend(p);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-3 rounded-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            {picked && (
              <button onClick={() => setPicked(null)} aria-label="ফিরে যান" className="rounded p-2 hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            {picked ? "সাইজ / রং বাছাই করুন" : "প্রোডাক্ট পাঠান"}
          </DialogTitle>
        </DialogHeader>

        {!picked ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম বা কোড দিয়ে খুঁজুন…" className="h-11 pl-9 text-base sm:h-10 sm:text-sm" />
              {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
              {!isFetching && rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">কোনো প্রোডাক্ট পাওয়া যায়নি</p>}
              {rows.map((p) => {
                const hasV = parseVariants(p.variants).options.length > 0;
                return (
                  <button
                    key={p.id}
                    disabled={sending}
                    onClick={() => choose(p)}
                    className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {p.primary_image_url ? (
                      <img src={pImg(p.primary_image_url)} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ৳{p.price} · {p.stock > 0 ? `স্টক ${p.stock}` : "স্টকে নেই"}
                        {hasV && " · সাইজ/রং আছে"}
                      </p>
                    </div>
                    {hasV ? <span className="text-xs text-primary">বাছাই →</span> : <Send className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              {picked.primary_image_url && <img src={pImg(picked.primary_image_url)} alt="" className="h-14 w-14 rounded-md object-cover" />}
              <div>
                <p className="font-medium">{picked.name}</p>
                <p className="text-sm text-muted-foreground">৳{chosen?.price ?? picked.price}{chosen?.stock != null && ` · স্টক ${chosen.stock}`}</p>
              </div>
            </div>
            {variants.options.map((o) => (
              <div key={o.name}>
                <p className="mb-2 text-sm font-medium">{optionLabelBn(o.name)}</p>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((v) => {
                    const ok = available(o.name, v);
                    const on = sel[o.name] === v;
                    return (
                      <button
                        key={v}
                        disabled={!ok}
                        onClick={() => setSel((s) => (on ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== o.name)) : { ...s, [o.name]: v }))}
                        className={cn(
                          "flex min-h-10 items-center gap-1 rounded-full border px-4 py-2 text-sm transition-colors sm:min-h-0 sm:px-3 sm:py-1.5",
                          on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                          !ok && "cursor-not-allowed line-through opacity-40",
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="sticky bottom-0 flex flex-col gap-2 bg-background pt-2 sm:flex-row">
              <Button className="h-11 flex-1 sm:h-10" disabled={sending || !allChosen} onClick={() => doSend(picked, sel)}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                নির্বাচিতটি পাঠান
              </Button>
              <Button variant="outline" className="h-11 sm:h-10" disabled={sending} onClick={() => doSend(picked)}>শুধু প্রোডাক্ট পাঠান</Button>
              <Button variant="ghost" className="h-11 sm:hidden" disabled={sending} onClick={() => onOpenChange(false)}>বাতিল</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function pImg(url?: string | null) {
  if (!url) return undefined;
  return /^(https?:|data:|blob:)/i.test(url) ? url : `/api/img/${url.replace(/^\/+/, "")}`;
}
