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
import { clearCart, type CartItem } from "@/lib/cart";
import { useCustomerSession } from "@/lib/customer-session";
import { computeFingerprint, getDeviceId } from "@/lib/fingerprint";
import { billingSummary, CYCLE_LABEL, nextBillingDate, type SubCycle } from "@/lib/subscriptions";
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
  useEffect(() => {
    if (settings) setAutoRenew(settings.auto_renew_default);
  }, [settings]);

  const allowed = settings?.payment_methods ?? [];
  const manual = MANUAL_METHODS.filter((m) => !allowed.length || allowed.includes(m.id));
  const online = (gateways as any[]).filter(
    (g) => !allowed.length || allowed.includes(g.key) || allowed.includes(g.id),
  );
  useEffect(() => {
    if (method) return;
    if (online.length) setMethod(online[0].key ?? `builtin:${online[0].id}`);
    else if (manual.length) setMethod(manual[0].id);
    else if (settings?.cod_enabled) setMethod("cod");
  }, [online.length, manual.length, settings?.cod_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = (meta.billing_cycle ?? settings?.default_billing_cycle ?? "monthly") as SubCycle;
  const qty = item?.qty ?? 1;
  const setupFee = Number(meta.setup_fee ?? settings?.setup_fee ?? 0);
  const summary = useMemo(
    () =>
      billingSummary({
        price: Number(item?.price ?? 0),
        qty,
        setupFee,
        taxPercent: Number(settings?.tax_percent ?? 0),
      }),
    [item?.price, qty, setupFee, settings?.tax_percent],
  );

  const trialEnabled = !!meta.trial?.enabled || !!settings?.allow_free_trial;
  const trialDays = meta.trial?.enabled
    ? Number(meta.trial.duration ?? 0) *
      (meta.trial.unit === "weeks" ? 7 : meta.trial.unit === "months" ? 30 : 1)
    : Number(settings?.trial_days ?? 0);
  const renewalPrice =
    meta.renewal_price_mode === "different" && meta.renewal_price != null
      ? Number(meta.renewal_price) * qty
      : summary.plan;
  const firstBilling = nextBillingDate(
    trialEnabled && trialDays > 0 ? new Date(Date.now() + trialDays * 86400000) : new Date(),
    cycle,
    meta.custom_cycle?.number
      ? Number(meta.custom_cycle.number) *
        (meta.custom_cycle.unit === "weeks" ? 7 : meta.custom_cycle.unit === "years" ? 365 : meta.custom_cycle.unit === "days" ? 1 : 30)
      : 30,
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
          clearCart(slug);
          window.location.href = (pay as any).redirect_url;
          return;
        }
      }
      clearCart(slug);
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

  const benefits: any[] = Array.isArray(meta.benefits) ? meta.benefits : [];
  const access: any[] = Array.isArray(meta.access_items) ? meta.access_items : [];

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Start your subscription</h1>
          <p className="text-sm text-muted-foreground">
            Recurring billing · cancel anytime from your account.
          </p>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Plan
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{item?.name}</div>
              <div className="text-xs text-muted-foreground">
                {CYCLE_LABEL[cycle] ?? cycle} billing{qty > 1 ? ` · ${qty} licenses` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{taka(summary.plan)}</div>
              <div className="text-[11px] text-muted-foreground">/ {CYCLE_LABEL[cycle] ?? cycle}</div>
            </div>
          </div>
          {trialEnabled && trialDays > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
              <Sparkles className="h-3.5 w-3.5" /> {trialDays}-day free trial — first charge on{" "}
              {firstBilling ? new Date(firstBilling).toLocaleDateString() : "—"}
            </div>
          )}
          {(benefits.length > 0 || access.length > 0) && (
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {[...access.map((a) => a.label), ...benefits.map((b) => b.title)]
                .filter(Boolean)
                .slice(0, 8)
                .map((label: string, i: number) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {label}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Subscriber details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-name">Full name</Label>
              <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-email">Email (invoices)</Label>
              <Input id="s-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-country">Country</Label>
              <Input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-company">Company (optional)</Label>
              <Input id="s-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-vat">VAT / BIN (optional)</Label>
              <Input id="s-vat" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="s-notes">Notes (optional)</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Payment method</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {online.map((g: any) => {
              const key = g.key ?? `builtin:${g.id}`;
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                    method === key ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <input type="radio" name="pm" checked={method === key} onChange={() => setMethod(key)} />
                  <span className="truncate">{g.label ?? g.name}</span>
                </label>
              );
            })}
            {manual.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  method === m.id ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <input type="radio" name="pm" checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span>{m.label}</span>
              </label>
            ))}
            {settings?.cod_enabled && (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                  method === "cod" ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <input type="radio" name="pm" checked={method === "cod"} onChange={() => setMethod("cod")} />
                <span>Cash on delivery</span>
              </label>
            )}
          </div>
          {isManual && (
            <div className="mt-3">
              <Label htmlFor="s-txn">Transaction ID</Label>
              <Input id="s-txn" required value={txnId} onChange={(e) => setTxnId(e.target.value)} />
            </div>
          )}
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
            <span>
              Auto-renew this subscription
              <span className="block text-xs text-muted-foreground">
                Renews at {taka(renewalPrice)} every {CYCLE_LABEL[cycle]?.toLowerCase() ?? cycle}.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            <span>Email me renewal reminders</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I accept the subscription, cancellation and refund terms</span>
          </label>
          {(settings?.subscription_terms || settings?.cancellation_policy || settings?.refund_policy) && (
            <div>
              <button
                type="button"
                onClick={() => setShowTerms((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition ${showTerms ? "rotate-180" : ""}`} /> Read the terms
              </button>
              {showTerms && (
                <div className="mt-2 space-y-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  {settings?.subscription_terms && <p>{settings.subscription_terms}</p>}
                  {settings?.cancellation_policy && <p>{settings.cancellation_policy}</p>}
                  {settings?.refund_policy && <p>{settings.refund_policy}</p>}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-20 lg:h-fit">
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Billing summary</div>
          <div className="flex justify-between py-0.5">
            <span className="text-muted-foreground">Plan</span>
            <span>{taka(summary.plan)}</span>
          </div>
          {summary.setup > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Setup fee</span>
              <span>{taka(summary.setup)}</span>
            </div>
          )}
          {summary.tax > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Tax ({settings?.tax_percent}%)</span>
              <span>{taka(summary.tax)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>Due today</span>
            <span>{trialEnabled && trialDays > 0 ? taka(summary.setup) : taka(summary.total)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {cycle === "lifetime"
              ? "One-time payment — never renews"
              : `Next billing ${firstBilling ? new Date(firstBilling).toLocaleDateString() : "—"} · ${taka(renewalPrice)}`}
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={submitting}>
            {submitting ? "Processing…" : trialEnabled && trialDays > 0 ? "Start free trial" : "Subscribe now"}
          </Button>
          <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout · cancel anytime
          </div>
        </div>
      </aside>
    </form>
  );
}
