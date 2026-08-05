// Dedicated Subscription checkout. Nothing here is shared with the physical,
// digital or service checkout flows.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listStoreOnlineGateways,
  startOnlineCheckout,
  placeOrder,
} from "@/lib/storefront.functions";
import { getPublicSubscriptionSettings } from "@/lib/subscriptions.functions";
import { removeSelected, type CartItem } from "@/lib/cart";
import { useCustomerSession } from "@/lib/customer-session";
import { computeFingerprint, getDeviceId } from "@/lib/fingerprint";
import { billingSummary, CYCLE_LABEL, nextBillingDate, type SubCycle } from "@/lib/subscriptions";
import {
  findPlan,
  planDays,
  planPeriodLabel,
  resolveBillingPlans,
} from "@/components/admin/product-form/subscription/subscription-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, ShieldCheck, CalendarClock, Sparkles, CheckCircle2, ChevronDown } from "lucide-react";

export type SubscriptionCartInfo = Record<string, any | null>;

const MANUAL_METHODS: { id: string; label: string }[] = [
  { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" },
  { id: "rocket", label: "Rocket" },
  { id: "bank", label: "Bank transfer" },
];

function taka(n: number) {
  return `৳${Number(n || 0).toLocaleString()}`;
}

export function SubscriptionCheckout({
  slug,
  store,
  items,
  info,
}: {
  slug: string;
  store: any;
  items: CartItem[];
  info: SubscriptionCartInfo;
}) {
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const listGw = useServerFn(listStoreOnlineGateways);
  const startPay = useServerFn(startOnlineCheckout);
  const getSettings = useServerFn(getPublicSubscriptionSettings);
  const { customer, token: customerToken } = useCustomerSession(slug);

  const item = items[0];
  const meta = (item ? info[item.productId] : null) ?? {};

  const { data: settings } = useQuery({
    enabled: !!store?.id,
    queryKey: ["subSettings", store?.id],
    queryFn: () => getSettings({ data: { storeId: store.id } }),
  });
  const { data: gateways = [] } = useQuery({
    enabled: !!store?.id,
    queryKey: ["onlineGateways", store?.id],
    queryFn: () => listGw({ data: { storeId: store.id } }),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [vat, setVat] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<string>("");
  const [txnId, setTxnId] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setName((v) => v || customer.full_name || "");
      setEmail((v) => v || customer.email || "");
      setPhone((v) => v || customer.phone || "");
    }
  }, [customer]);
  // Plans come from the subscription product itself.
  const plans = useMemo(
    () => resolveBillingPlans(meta, Number(item?.price ?? 0)),
    [meta, item?.price],
  );
  const [planId, setPlanId] = useState<string>("");
  useEffect(() => {
    if (!planId && plans.length) setPlanId((findPlan(plans, null) ?? plans[0]).id);
  }, [plans, planId]);
  const plan = findPlan(plans, planId || null);

  useEffect(() => {
    if (meta.renewal?.mode === "manual") setAutoRenew(false);
  }, [meta.renewal?.mode]);

  const allowed = settings?.payment_methods ?? [];
  // A manual method only exists if the store owner actually configured it
  // (enabled + a number / account) in the admin Payments settings.
  const pc = (store as any)?.payments_config ?? {};
  const manual = MANUAL_METHODS.filter((m) => {
    if (allowed.length && !allowed.includes(m.id)) return false;
    const cfg = pc[m.id];
    if (!cfg || cfg.enabled === false) return false;
    return !!(cfg.number || cfg.account);
  });
  const online = (gateways as any[]).filter(
    (g) => !allowed.length || allowed.includes(g.key) || allowed.includes(g.id),
  );
  useEffect(() => {
    if (method) return;
    if (online.length) setMethod(online[0].key ?? `builtin:${online[0].id}`);
    else if (manual.length) setMethod(manual[0].id);
    else if (settings?.cod_enabled) setMethod("cod");
  }, [online.length, manual.length, settings?.cod_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = (plan?.cycle ?? meta.billing_cycle ?? "monthly") as SubCycle;
  const qty = item?.qty ?? 1;
  const setupFee = Number(meta.setup_fee ?? 0);
  const summary = useMemo(
    () =>
      billingSummary({
        price: Number(plan?.price ?? item?.price ?? 0),
        qty,
        setupFee,
        taxPercent: 0,
      }),
    [plan?.price, item?.price, qty, setupFee],
  );

  const trialEnabled = !!meta.trial?.enabled;
  const trialDays = meta.trial?.enabled
    ? Number(meta.trial.duration ?? 0) *
      (meta.trial.unit === "weeks" ? 7 : meta.trial.unit === "months" ? 30 : 1)
    : 0;
  const renewalPrice =
    meta.renewal_price_mode === "different" && meta.renewal_price != null
      ? Number(meta.renewal_price) * qty
      : summary.plan;
  const firstBilling = nextBillingDate(
    trialEnabled && trialDays > 0 ? new Date(Date.now() + trialDays * 86400000) : new Date(),
    cycle,
    planDays(plan) ?? 30,
  );


  const isOnline = method.startsWith("builtin:") || method.startsWith("custom:");
  const isManual = !isOnline && method !== "cod" && !!method;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) return toast.error("Please accept the subscription terms");
    if (!method) return toast.error("Choose a payment method");
    setSubmitting(true);
    try {
      const [fingerprint, deviceId] = [await computeFingerprint(), getDeviceId()];
      const res = await place({
        data: {
          storeId: store.id,
          customerName: name,
          phone,
          email: email.trim(),
          company: company.trim() || undefined,
          country: country.trim() || undefined,
          paymentMethod: method,
          txnId: isManual ? txnId : undefined,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          customerToken: customerToken ?? undefined,
          fingerprint: fingerprint || undefined,
          deviceId: deviceId || undefined,
          subscription: {
            billingCycle: cycle,
            autoRenew,
            remindersOptIn: reminders,
            vat: vat.trim() || undefined,
            acceptedTerms: true,
          },
        } as any,
      });

      if (isOnline) {
        const pay = await startPay({ data: { orderId: (res as any).orderId, gatewayKey: method } });
        if ((pay as any)?.redirect_url) {
          removeSelected(slug, items.map((i) => i.productId));
          window.location.href = (pay as any).redirect_url;
          return;
        }
      }
      removeSelected(slug, items.map((i) => i.productId));
      navigate({
        to: "/store/$slug/order/$orderId",
        params: { slug, orderId: (res as any).orderId },
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start the subscription");
    } finally {
      setSubmitting(false);
    }
  }

  const policies: any = meta.policies ?? {};
  const benefits: any[] = Array.isArray(meta.benefits) ? meta.benefits : [];
  const access: any[] = Array.isArray(meta.access_items) ? meta.access_items : [];

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-full px-2 py-3 sm:px-4 sm:py-6 lg:max-w-5xl lg:grid lg:grid-cols-[1fr_360px] lg:gap-6"
    >
      <div className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div>
          <h1 className="text-lg font-semibold leading-tight sm:text-xl lg:text-2xl">Start your subscription</h1>
          <p className="text-[11px] text-muted-foreground sm:text-sm">
            Recurring billing · cancel anytime from your account.
          </p>
        </div>

        <section className="rounded-lg border bg-card p-2.5 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground sm:text-xs">
            <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Plan
          </div>
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium sm:text-base">{item?.name}</div>
              <div className="text-[11px] text-muted-foreground sm:text-xs">
                {CYCLE_LABEL[cycle] ?? cycle} billing{qty > 1 ? ` · ${qty} licenses` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold sm:text-base">{taka(summary.plan)}</div>
              <div className="text-[10px] text-muted-foreground sm:text-[11px]">/ {CYCLE_LABEL[cycle] ?? cycle}</div>
            </div>
          </div>
          {trialEnabled && trialDays > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-sky-50 p-2 text-[11px] text-sky-800">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {trialDays}-day free trial — first charge on{" "}
              {firstBilling ? new Date(firstBilling).toLocaleDateString() : "—"}
            </div>
          )}
          {(benefits.length > 0 || access.length > 0) && (
            <ul className="mt-2 grid gap-1 sm:mt-3 sm:grid-cols-2">
              {[...access.map((a) => a.label), ...benefits.map((b) => b.title)]
                .filter(Boolean)
                .slice(0, 8)
                .map((label: string, i: number) => (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 sm:h-3.5 sm:w-3.5" /> {label}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-card p-2.5 sm:p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground sm:text-xs">
            Subscriber details
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="space-y-1">
              <Label htmlFor="s-name" className="text-xs">Full name</Label>
              <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-email" className="text-xs">Email (invoices)</Label>
              <Input id="s-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-phone" className="text-xs">Phone</Label>
              <Input id="s-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-country" className="text-xs">Country</Label>
              <Input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-company" className="text-xs">Company (optional)</Label>
              <Input id="s-company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-vat" className="text-xs">VAT / BIN (optional)</Label>
              <Input id="s-vat" value={vat} onChange={(e) => setVat(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
          </div>
          <div className="mt-2 space-y-1 sm:mt-3">
            <Label htmlFor="s-notes" className="text-xs">Notes (optional)</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm" />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-2.5 sm:p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground sm:text-xs">
            Payment method
          </div>
          <div className="grid gap-2">
            {online.map((g: any) => {
              const key = g.key ?? `builtin:${g.id}`;
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm sm:p-3 ${
                    method === key ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <input type="radio" name="pm" checked={method === key} onChange={() => setMethod(key)} />
                  <span className="truncate text-sm">{g.label ?? g.name}</span>
                </label>
              );
            })}
            {manual.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm sm:p-3 ${
                  method === m.id ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <input type="radio" name="pm" checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
            {settings?.cod_enabled && (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm sm:p-3 ${
                  method === "cod" ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <input type="radio" name="pm" checked={method === "cod"} onChange={() => setMethod("cod")} />
                <span className="text-sm">Cash on delivery</span>
              </label>
            )}
          </div>
          {isManual && (
            <div className="mt-2 space-y-1 sm:mt-3">
              <Label htmlFor="s-txn" className="text-xs">Transaction ID</Label>
              <Input id="s-txn" required value={txnId} onChange={(e) => setTxnId(e.target.value)} className="h-8 text-sm sm:h-10" />
            </div>
          )}
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-2.5 sm:p-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
            <span className="text-sm">
              Auto-renew this subscription
              <span className="block text-[11px] text-muted-foreground sm:text-xs">
                Renews at {taka(renewalPrice)} every {CYCLE_LABEL[cycle]?.toLowerCase() ?? cycle}.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            <span className="text-sm">Email me renewal reminders</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span className="text-sm">I accept the subscription, cancellation and refund terms</span>
          </label>
          {(policies.terms || policies.cancellation || policies.refund) && (
            <div>
              <button
                type="button"
                onClick={() => setShowTerms((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground sm:text-xs"
              >
                <ChevronDown className={`h-3 w-3 transition sm:h-3.5 sm:w-3.5 ${showTerms ? "rotate-180" : ""}`} /> Read the terms
              </button>
              {showTerms && (
                <div className="mt-2 space-y-2 whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px] text-muted-foreground sm:p-3 sm:text-xs">
                  {policies.terms && <p>{policies.terms}</p>}
                  {policies.cancellation && <p>{policies.cancellation}</p>}
                  {policies.refund && <p>{policies.refund}</p>}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="mt-3 space-y-3 sm:mt-4 lg:sticky lg:top-20 lg:mt-0 lg:h-fit">
        <div className="rounded-lg border bg-card p-2.5 text-sm sm:p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground sm:text-xs">
            Billing summary
          </div>
          <div className="flex justify-between py-0.5 text-sm">
            <span className="text-muted-foreground">Plan</span>
            <span>{taka(summary.plan)}</span>
          </div>
          {summary.setup > 0 && (
            <div className="flex justify-between py-0.5 text-sm">
              <span className="text-muted-foreground">Setup fee</span>
              <span>{taka(summary.setup)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Due today</span>
            <span>{trialEnabled && trialDays > 0 ? taka(summary.setup) : taka(summary.total)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground sm:text-[11px]">
            <CalendarClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {cycle === "lifetime"
              ? "One-time payment — never renews"
              : `Next billing ${firstBilling ? new Date(firstBilling).toLocaleDateString() : "—"} · ${taka(renewalPrice)}`}
          </div>
          <Button type="submit" className="mt-3 h-10 w-full text-sm sm:h-11" disabled={submitting}>
            {submitting ? "Processing…" : trialEnabled && trialDays > 0 ? "Start free trial" : "Subscribe now"}
          </Button>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
            <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Secure checkout · cancel anytime
          </div>
        </div>
      </aside>
    </form>
  );
}
