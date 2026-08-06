// Quick Order — manual order creation for phone / WhatsApp / Messenger sales.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Minus, PackageSearch, Phone, Plus,
  Search, ShoppingBag, Trash2, UserRound, Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  searchQuickOrderCustomers, getQuickOrderCustomerContext,
  searchQuickOrderProducts, createQuickOrder,
} from "@/lib/quick-order.functions";
import { listDeliveryZones } from "@/lib/admin.functions";

const money = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

function resolveImg(url?: string | null) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

function PickThumb({ url, className = "" }: { url?: string | null; className?: string }) {
  const [err, setErr] = useState(false);
  const src = resolveImg(url);
  if (!src || err) {
    return (
      <div className={`grid shrink-0 place-items-center rounded bg-muted ${className}`}>
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      className={`shrink-0 rounded border object-cover ${className}`}
    />
  );
}

type Line = {
  productId: string;
  name: string;
  image: string | null;
  unit: number;
  qty: number;
  stock: number;
  variant?: string;
  variantId?: string;
};

type Cust = {
  id: string | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  zoneId: string | null;
  note: string;
  saveAddress: boolean;
};

const EMPTY: Cust = {
  id: null, name: "", phone: "", email: "", address: "",
  area: "", zoneId: null, note: "", saveAddress: true,
};

const STEPS = ["Customer", "Details", "Products", "Pricing", "Payment", "Review"] as const;

export function QuickOrderSheet({
  open, onOpenChange, presetPhone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetPhone?: string | null;
}) {
  const qc = useQueryClient();
  const searchCustomers = useServerFn(searchQuickOrderCustomers);
  const customerContext = useServerFn(getQuickOrderCustomerContext);
  const searchProducts = useServerFn(searchQuickOrderProducts);
  const create = useServerFn(createQuickOrder);

  const [step, setStep] = useState(0);
  const [cust, setCust] = useState<Cust>(EMPTY);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [deliveryOverride, setDeliveryOverride] = useState("");
  const [additional, setAdditional] = useState("");
  const [coupon, setCoupon] = useState("");
  const [payMethod, setPayMethod] = useState("cod");
  const [payState, setPayState] = useState<"unpaid" | "partial" | "paid">("unpaid");
  const [paidInput, setPaidInput] = useState("");
  const [txnId, setTxnId] = useState("");
  const [notes, setNotes] = useState("");
  const [allowOversell, setAllowOversell] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ invoiceNo: string | null; total: number; due: number } | null>(null);

  // Search state
  const [cTerm, setCTerm] = useState("");
  const [cResults, setCResults] = useState<any[]>([]);
  const [cLoading, setCLoading] = useState(false);
  const [pTerm, setPTerm] = useState("");
  const [pCat, setPCat] = useState<string>("all");
  const [ctx, setCtx] = useState<any>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(0); setCust(EMPTY); setLines([]); setDiscount(""); setDeliveryOverride("");
    setAdditional(""); setCoupon(""); setPayMethod("cod"); setPayState("unpaid");
    setPaidInput(""); setTxnId(""); setNotes(""); setAllowOversell(false);
    setCTerm(""); setCResults([]); setPTerm(""); setPCat("all"); setCtx(null); setDone(null);
  }

  useEffect(() => {
    if (!open) return;
    reset();
    if (presetPhone) { setCTerm(presetPhone); setCust((c) => ({ ...c, phone: presetPhone })); }
  }, [open, presetPhone]);

  const zonesQ = useQuery({
    queryKey: ["admin", "quick-order", "zones"],
    queryFn: () => listDeliveryZones(),
    enabled: open,
  });
  const zones = (zonesQ.data ?? []).filter((z: any) => z.is_active);

  const productsQ = useQuery({
    queryKey: ["admin", "quick-order", "products", pTerm, pCat],
    queryFn: () => searchProducts({ data: { term: pTerm, categoryId: pCat === "all" ? null : pCat } }),
    enabled: open,
  });
  const products = productsQ.data?.products ?? [];
  const categories = productsQ.data?.categories ?? [];

  // Debounced customer search
  useEffect(() => {
    if (!open || cTerm.trim().length < 2) { setCResults([]); return; }
    let alive = true;
    setCLoading(true);
    const t = setTimeout(async () => {
      try {
        const r: any = await searchCustomers({ data: { term: cTerm.trim() } });
        if (alive) setCResults(r ?? []);
      } finally { if (alive) setCLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [cTerm, open, searchCustomers]);

  async function pickCustomer(c: any) {
    setCust({
      id: c.id, name: c.name ?? "", phone: c.phone ?? "", email: c.email ?? "",
      address: c.address ?? "", area: c.area ?? "", zoneId: c.deliveryZoneId ?? null,
      note: "", saveAddress: true,
    });
    setStep(1);
    try {
      const r: any = await customerContext({ data: { phone: c.phone ?? "", customerId: c.id ?? null } });
      setCtx(r);
    } catch { /* panel is optional */ }
  }

  function addProduct(p: any, variant?: { id: string; label: string; price?: number | null; stock?: number | null }) {
    const key = `${p.id}:${variant?.id ?? ""}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => `${l.productId}:${l.variantId ?? ""}` === key);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          image: p.image,
          unit: variant?.price != null && Number(variant.price) > 0 ? Number(variant.price) : Number(p.price),
          qty: 1,
          stock: variant?.stock != null ? Number(variant.stock) : Number(p.stock ?? 0),
          variant: variant?.label,
          variantId: variant?.id,
        },
      ];
    });
  }

  const subtotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);
  const zone = zones.find((z: any) => z.id === cust.zoneId);
  const deliveryBase = deliveryOverride !== "" ? Number(deliveryOverride) : Number(zone?.charge ?? 0);
  const extra = Number(additional || 0);
  const disc = Math.min(Number(discount || 0), subtotal);
  const total = Math.max(0, subtotal + deliveryBase + extra - disc);
  const paid = payState === "paid" ? total : payState === "partial" ? Math.min(Number(paidInput || 0), total) : 0;
  const due = Math.max(0, total - paid);
  const oversell = lines.some((l) => l.qty > l.stock);

  const canNext = useMemo(() => {
    if (step === 0) return cust.phone.trim().length >= 5 || !!cust.id;
    if (step === 1) return cust.name.trim() && cust.phone.trim().length >= 5 && cust.address.trim().length >= 3;
    if (step === 2) return lines.length > 0 && (!oversell || allowOversell);
    return true;
  }, [step, cust, lines, oversell, allowOversell]);

  async function submit() {
    setSaving(true);
    try {
      const res: any = await create({
        data: {
          customer: {
            id: cust.id, name: cust.name.trim(), phone: cust.phone.trim(),
            email: cust.email.trim() || undefined,
            address: cust.address.trim(), area: cust.area.trim() || undefined,
            deliveryZoneId: cust.zoneId, note: cust.note.trim() || undefined,
            saveAddress: cust.saveAddress,
          },
          items: lines.map((l) => ({
            productId: l.productId, qty: l.qty,
            variant: l.variant, variantId: l.variantId,
          })),
          discount: disc || undefined,
          deliveryCharge: deliveryOverride !== "" ? Number(deliveryOverride) : (zone ? undefined : 0),
          additionalCharge: extra || undefined,
          couponCode: coupon.trim() || undefined,
          paymentMethod: payMethod as any,
          paymentState: payState,
          paidAmount: payState === "partial" ? Number(paidInput || 0) : undefined,
          txnId: txnId.trim() || undefined,
          notes: notes.trim() || undefined,
          allowOversell,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      setDone({ invoiceNo: res.invoiceNo, total: res.total, due: res.due });
      toast.success("Order created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" /> Create order
          </SheetTitle>
          {!done && (
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pt-1">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => i < step && setStep(i)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    i === step ? "bg-primary text-primary-foreground"
                      : i < step ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {i + 1}. {s}
                </button>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold">Order created</p>
                <p className="text-sm text-muted-foreground">
                  {done.invoiceNo ? `Invoice ${done.invoiceNo} · ` : ""}{money(done.total)}
                  {done.due > 0 ? ` · due ${money(done.due)}` : " · fully paid"}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => reset()}>Create another</Button>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0 space-y-4">
                {/* 1. Customer lookup */}
                {step === 0 && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={cTerm}
                        onChange={(e) => setCTerm(e.target.value)}
                        placeholder="Search by phone, name or email…"
                        className="pl-9"
                      />
                    </div>
                    {cLoading && <p className="text-xs text-muted-foreground">Searching…</p>}
                    <div className="space-y-2">
                      {cResults.map((c, i) => (
                        <button
                          key={`${c.id ?? c.phone}-${i}`}
                          onClick={() => pickCustomer(c)}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{c.name || "Unnamed"}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <Phone className="mr-1 inline h-3 w-3" />{c.phone}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-muted-foreground">
                            <p>{c.orders} orders</p>
                            <p>{money(c.spend)}</p>
                          </div>
                        </button>
                      ))}
                      {!cLoading && cTerm.trim().length >= 2 && cResults.length === 0 && (
                        <p className="text-xs text-muted-foreground">No match — continue as a new customer.</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => {
                        setCust({ ...EMPTY, phone: /^[0-9+\s-]+$/.test(cTerm) ? cTerm.trim() : "", name: /^[0-9+\s-]+$/.test(cTerm) ? "" : cTerm.trim() });
                        setCtx(null);
                        setStep(1);
                      }}
                    >
                      <Plus className="h-4 w-4" /> New customer
                    </Button>
                  </div>
                )}

                {/* 2. Details */}
                {step === 1 && (
                  <div className="space-y-3">
                    {cust.id && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Existing customer — details prefilled
                      </Badge>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Full name">
                        <Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                      </Field>
                      <Field label="Phone">
                        <Input value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                      </Field>
                      <Field label="Email (optional)">
                        <Input value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
                      </Field>
                      <Field label="Delivery zone">
                        <Select
                          value={cust.zoneId ?? "none"}
                          onValueChange={(v) => setCust({ ...cust, zoneId: v === "none" ? null : v })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No zone</SelectItem>
                            {zones.map((z: any) => (
                              <SelectItem key={z.id} value={z.id}>{z.name} — {money(z.charge)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Area / thana">
                      <Input value={cust.area} onChange={(e) => setCust({ ...cust, area: e.target.value })} />
                    </Field>
                    <Field label="Full address">
                      <Textarea rows={3} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                    </Field>
                    {!!ctx?.addresses?.length && (
                      <div className="flex flex-wrap gap-1.5">
                        {ctx.addresses.map((a: any) => (
                          <button
                            key={a.id}
                            onClick={() => setCust({ ...cust, address: a.address, area: a.area ?? cust.area })}
                            className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-muted"
                          >
                            {a.label || "Saved"} · {String(a.address).slice(0, 28)}…
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Save address to customer</p>
                        <p className="text-xs text-muted-foreground">Reuse it on the next manual order</p>
                      </div>
                      <Switch checked={cust.saveAddress} onCheckedChange={(v) => setCust({ ...cust, saveAddress: v })} />
                    </div>
                  </div>
                )}

                {/* 3. Products */}
                {step === 2 && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          ref={scanRef}
                          value={pTerm}
                          onChange={(e) => setPTerm(e.target.value)}
                          placeholder="Search product, SKU or scan barcode…"
                          className="pl-9"
                        />
                      </div>
                      <Select value={pCat} onValueChange={setPCat}>
                        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                      {products.map((p: any) => {
                        const vItems: any[] = Array.isArray(p.variants?.items) ? p.variants.items : [];
                        return (
                          <div key={p.id} className="rounded-lg border p-2">
                            <div className="flex items-center gap-2">
                              <PickThumb url={p.image} className="h-10 w-10" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {money(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : <span className="text-destructive">out of stock</span>}
                                </p>
                              </div>
                              {vItems.length === 0 && (
                                <Button size="sm" variant="outline" onClick={() => addProduct(p)}>
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                            {vItems.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {vItems.map((v: any) => {
                                  const label = Object.values(v.options ?? {}).join(" / ");
                                  return (
                                    <button
                                      key={v.id}
                                      onClick={() => addProduct(p, { id: String(v.id), label, price: v.price, stock: v.stock })}
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
                                    >
                                      {label || "Variant"}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!productsQ.isLoading && products.length === 0 && (
                        <p className="text-xs text-muted-foreground">No physical products match.</p>
                      )}
                    </div>

                    <Separator />
                    <div className="space-y-2">
                      {lines.length === 0 && <p className="text-xs text-muted-foreground">No items yet.</p>}
                      {lines.map((l, i) => (
                        <div key={`${l.productId}-${l.variantId ?? ""}`} className="flex items-center gap-2 rounded-lg border p-2">
                          {l.image
                            ? <img src={l.image} alt="" className="h-9 w-9 rounded object-cover" />
                            : <div className="h-9 w-9 rounded bg-muted" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{l.name}{l.variant ? ` — ${l.variant}` : ""}</p>
                            <p className="text-xs text-muted-foreground">
                              {money(l.unit)} each{l.qty > l.stock ? " · exceeds stock" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => setLines((p) => p.map((x, j) => j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{l.qty}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7"
                              onClick={() => setLines((p) => p.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x))}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                              onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {oversell && (
                        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                          <p className="text-xs">Some items exceed available stock.</p>
                          <div className="flex items-center gap-2 text-xs">
                            Allow <Switch checked={allowOversell} onCheckedChange={setAllowOversell} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Pricing */}
                {step === 3 && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={`Delivery charge${zone ? ` (zone: ${zone.name})` : ""}`}>
                        <Input
                          inputMode="numeric"
                          value={deliveryOverride}
                          placeholder={String(zone?.charge ?? 0)}
                          onChange={(e) => setDeliveryOverride(e.target.value.replace(/[^0-9.]/g, ""))}
                        />
                      </Field>
                      <Field label="Additional charge">
                        <Input inputMode="numeric" value={additional}
                          onChange={(e) => setAdditional(e.target.value.replace(/[^0-9.]/g, ""))} />
                      </Field>
                      <Field label="Manual discount">
                        <Input inputMode="numeric" value={discount}
                          onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))} />
                      </Field>
                      <Field label="Coupon code (optional)">
                        <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
                      </Field>
                    </div>
                    <Field label="Internal note">
                      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ordered via WhatsApp, call before delivery…" />
                    </Field>
                    <Totals subtotal={subtotal} delivery={deliveryBase} extra={extra} disc={disc} total={total} />
                  </div>
                )}

                {/* 5. Payment */}
                {step === 4 && (
                  <div className="space-y-3">
                    <Field label="Payment method">
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">Cash on delivery</SelectItem>
                          <SelectItem value="bkash">bKash</SelectItem>
                          <SelectItem value="nagad">Nagad</SelectItem>
                          <SelectItem value="rocket">Rocket</SelectItem>
                          <SelectItem value="bank">Bank transfer</SelectItem>
                          <SelectItem value="online">Online gateway</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      {(["unpaid", "partial", "paid"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPayState(s)}
                          className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                            payState === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          {s === "partial" ? "Advance" : s}
                        </button>
                      ))}
                    </div>
                    {payState === "partial" && (
                      <Field label="Advance received">
                        <Input inputMode="numeric" value={paidInput}
                          onChange={(e) => setPaidInput(e.target.value.replace(/[^0-9.]/g, ""))} />
                      </Field>
                    )}
                    {payMethod !== "cod" && payState !== "unpaid" && (
                      <Field label="Transaction ID">
                        <Input value={txnId} onChange={(e) => setTxnId(e.target.value)} />
                      </Field>
                    )}
                    <div className="rounded-lg border p-3 text-sm">
                      <Row label="Order total" value={money(total)} />
                      <Row label="Paid now" value={money(paid)} />
                      <Row label="Due" value={money(due)} strong />
                    </div>
                  </div>
                )}

                {/* 6. Review */}
                {step === 5 && (
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">{cust.name}</p>
                      <p className="text-xs text-muted-foreground">{cust.phone}{cust.email ? ` · ${cust.email}` : ""}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{cust.address}{cust.area ? `, ${cust.area}` : ""}</p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border p-3">
                      {lines.map((l) => (
                        <div key={`${l.productId}-${l.variantId ?? ""}`} className="flex justify-between text-sm">
                          <span className="truncate pr-2">{l.name}{l.variant ? ` — ${l.variant}` : ""} × {l.qty}</span>
                          <span>{money(l.unit * l.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <Totals subtotal={subtotal} delivery={deliveryBase} extra={extra} disc={disc} total={total} />
                    <div className="rounded-lg border p-3 text-sm">
                      <Row label="Payment" value={`${payMethod.toUpperCase()} · ${payState}`} />
                      <Row label="Paid" value={money(paid)} />
                      <Row label="Due" value={money(due)} strong />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The order is created as confirmed: invoice number, stock deduction and
                      notifications run exactly like a storefront order.
                    </p>
                  </div>
                )}
              </div>

              {/* Customer side panel */}
              {ctx && step > 0 && (
                <aside className="hidden space-y-3 lg:block">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Customer</p>
                    {ctx.stats.vip && <Badge className="mt-1">VIP</Badge>}
                    <div className="mt-2 space-y-1 text-xs">
                      <Row label="Orders" value={String(ctx.stats.orders)} />
                      <Row label="Spend" value={money(ctx.stats.spend)} />
                      <Row label="AOV" value={money(ctx.stats.aov)} />
                      <Row label="Cancelled" value={String(ctx.stats.cancelled)} />
                      <Row label="Returns" value={String(ctx.stats.returns)} />
                    </div>
                  </div>
                  {!!ctx.recentProducts?.length && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Quick reorder</p>
                      <div className="mt-2 space-y-1.5">
                        {ctx.recentProducts.slice(0, 6).map((p: any) => (
                          <button
                            key={p.productId}
                            onClick={async () => {
                              const r: any = await searchProducts({ data: { ids: [p.productId] } });
                              const prod = r?.products?.[0];
                              if (prod) { addProduct(prod); toast.success(`${prod.name} added`); }
                              else toast.error("Product no longer available");
                            }}
                            className="w-full truncate rounded-md border px-2 py-1 text-left text-[11px] hover:bg-muted"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {ctx.note && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Note</p>
                      <p className="mt-1 text-xs">{ctx.note}</p>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </div>

        {!done && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total </span>
              <span className="font-semibold">{money(total)}</span>
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button disabled={!canNext} onClick={() => setStep(step + 1)} className="gap-1.5">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button disabled={saving || lines.length === 0} onClick={submit} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Create order
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function Totals({ subtotal, delivery, extra, disc, total }: {
  subtotal: number; delivery: number; extra: number; disc: number; total: number;
}) {
  return (
    <div className="space-y-1 rounded-lg border p-3 text-sm">
      <Row label="Subtotal" value={money(subtotal)} />
      <Row label="Delivery" value={money(delivery)} />
      {extra > 0 && <Row label="Additional" value={money(extra)} />}
      {disc > 0 && <Row label="Discount" value={`- ${money(disc)}`} />}
      <Separator className="my-1" />
      <Row label="Total" value={money(total)} strong />
    </div>
  );
}
