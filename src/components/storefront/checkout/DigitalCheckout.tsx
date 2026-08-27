import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listStoreOnlineGateways,
  placeOrder,
  startOnlineCheckout,
  validateCoupon,
} from "@/lib/storefront.functions";
import { removeSelected, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCustomerSession } from "@/lib/customer-session";
import { writeOrderContact } from "@/lib/order-proof";
import { computeFingerprint, getDeviceId } from "@/lib/fingerprint";
import { LICENSE_LABELS, formatBytes, type LicenseType } from "@/lib/digital";
import { Download, ShieldCheck, Sparkles, Loader2, Lock } from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";

export type DigitalCartInfo = Record<
  string,
  { version: string | null; license_type: string; file_count: number; total_size: number } | null
>;

type Props = {
  slug: string;
  store: any;
  items: CartItem[];
  info: DigitalCartInfo;
};

/**
 * Digital-first checkout: no address, no courier, no cash on delivery.
 * Only online gateways are offered, because access is granted the second
 * the payment is confirmed.
 */
export function DigitalCheckout({ slug, store, items, info }: Props) {
  const { t } = useStoreT();
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const startPay = useServerFn(startOnlineCheckout);
  const valCoupon = useServerFn(validateCoupon);
  const listGw = useServerFn(listStoreOnlineGateways);
  const { customer, token: customerToken } = useCustomerSession(slug);

  const { data: gateways = [] } = useQuery({
    enabled: !!store?.id,
    queryKey: ["onlineGateways", store?.id],
    queryFn: () => listGw({ data: { storeId: store.id } }),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [agreeDigital, setAgreeDigital] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [stage, setStage] = useState<"idle" | "creating" | "redirecting">("idle");

  useEffect(() => {
    if (customer) {
      if (!name && customer.full_name) setName(customer.full_name);
      if (!phone && customer.phone) setPhone(customer.phone);
      if (!email && (customer as any).email) setEmail((customer as any).email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  useEffect(() => {
    if (!method && gateways.length) setMethod((gateways as any[])[0].key);
  }, [gateways, method]);

  const subtotal = useMemo(() => items.reduce((a, i) => a + i.qty * i.price, 0), [items]);
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const busy = stage !== "idle";

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setApplying(true);
    try {
      const res = await valCoupon({
        data: { storeId: store.id, code: couponCode.trim(), subtotal },
      });
      if (!res.ok) {
        toast.error(res.error);
        setCoupon(null);
      } else {
        setCoupon({ code: res.code, discount: res.discount });
        toast.success(t("checkout.couponApplied"));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeDigital || !agreeTerms) {
      toast.error(t("checkout.digital.acceptBoth"));
      return;
    }
    if (total > 0 && !method) {
      toast.error(t("checkout.choosePaymentMethod"));
      return;
    }
    setStage("creating");
    try {
      const [fingerprint, deviceId] = [await computeFingerprint(), getDeviceId()];
      const res = await place({
        data: {
          storeId: store.id,
          customerName: name,
          phone,
          email,
          company: company || undefined,
          country: country || undefined,
          notes: notes || undefined,
          paymentMethod: total > 0 ? method : "bank",
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          couponCode: coupon?.code,
          customerToken: customerToken ?? undefined,
          fingerprint: fingerprint || undefined,
          deviceId: deviceId || undefined,
        },
      });
      if ((res as any)?.warning) toast.warning((res as any).warning);

      // Remember the contact used at checkout so the order page can prove
      // ownership without asking the shopper to retype phone/email.
      writeOrderContact(res.orderId, (phone || email || "").trim());

      if (total > 0) {
        setStage("redirecting");
        // Retry once — gateways occasionally fail to open a session.
        let pay: any = null;
        for (let attempt = 0; attempt < 2 && !pay?.redirect_url; attempt++) {
          try {
            pay = await startPay({ data: { orderId: res.orderId, gatewayKey: method } });
          } catch {
            /* retry */
          }
        }
        if (pay?.redirect_url) {
          removeSelected(slug, items.map((i) => i.productId));
          window.location.href = pay.redirect_url;
          return;
        }
        throw new Error(t("checkout.paymentStartFailed"));
      }

      removeSelected(slug, items.map((i) => i.productId));
      navigate({ to: "/store/$slug/order/$orderId", params: { slug, orderId: res.orderId } });
    } catch (err) {
      toast.error((err as Error).message);
      setStage("idle");
    }
  }

  if (busy) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <h2 className="mt-4 text-lg font-semibold">
          {stage === "creating" ? t("checkout.digital.securing") : t("checkout.digital.openingPayment")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("checkout.dontCloseRefresh")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6 sm:grid-cols-5">
      <div className="sm:col-span-3 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{t("checkout.digital.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("checkout.digital.subtitle")}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.customerInfo")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">{t("common.fullName")} *</Label>
              <Input id="d-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-email">{t("checkout.emailAddress")}</Label>
              <Input
                id="d-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-phone">{t("checkout.phoneNumber")}</Label>
              <Input id="d-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-country">{t("checkout.countryOptional")}</Label>
              <Input id="d-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="d-company">{t("checkout.companyNameOptional")}</Label>
              <Input id="d-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="d-notes">{t("checkout.orderNote")}</Label>
              <Textarea id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            {t("checkout.digital.emailNotice")}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.paymentMethod")}</h2>
          {total === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("checkout.digital.freeOrder")}
            </p>
          ) : gateways.length === 0 ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {t("checkout.digital.noGateway")}
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {(gateways as any[]).map((g) => (
                <label
                  key={g.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                    method === g.key ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="d-method"
                    checked={method === g.key}
                    onChange={() => setMethod(g.key)}
                  />
                  {g.logo_url ? (
                    <img src={g.logo_url} alt="" className="h-6 w-auto" />
                  ) : null}
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{g.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.sandbox ? t("checkout.payOnlineTest") : t("checkout.payOnlineSecure")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t("checkout.digital.noCod")}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-4">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={agreeDigital}
              onCheckedChange={(v) => setAgreeDigital(v === true)}
              className="mt-0.5"
            />
            <span>{t("checkout.digital.agreeDigital")}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={agreeTerms}
              onCheckedChange={(v) => setAgreeTerms(v === true)}
              className="mt-0.5"
            />
            <span>
              {t("checkout.digital.agreeTermsPrefix")}{" "}
              <Link to="/terms" className="underline">
                {t("footer.terms")}
              </Link>
              .
            </span>
          </label>
        </div>
      </div>

      <aside className="sm:col-span-2">
        <div className="sticky top-20 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.orderSummary")}</h2>
          <ul className="mt-3 space-y-3">
            {items.map((i) => {
              const d = info[i.productId] ?? null;
              return (
                <li key={i.productId} className="flex gap-3">
                  {i.image ? (
                    <img
                      src={i.image}
                      alt={i.name}
                      className="h-14 w-14 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border bg-muted">
                      <Download className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d?.version ? `v${d.version} · ` : ""}
                      {LICENSE_LABELS[(d?.license_type ?? "personal") as LicenseType]}
                      {d?.total_size ? ` · ${formatBytes(d.total_size)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("checkout.digital.qty", { n: i.qty })}</p>
                  </div>
                  <span className="text-sm">৳{(i.qty * i.price).toFixed(0)}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { icon: Download, label: t("checkout.digital.instantDownload") },
              { icon: Sparkles, label: t("checkout.digital.digitalProduct") },
              { icon: ShieldCheck, label: t("checkout.securePurchase") },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium"
              >
                <Icon className="h-3 w-3" /> {label}
              </span>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <Input
              placeholder={t("checkout.couponCode")}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="h-9"
            />
            {coupon ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCoupon(null);
                  setCouponCode("");
                }}
              >
                {t("checkout.remove")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={applyCoupon}
                disabled={applying || !couponCode.trim()}
              >
                {applying ? t("checkout.applying") : t("checkout.applyCoupon")}
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>{t("checkout.subtotal")}</span>
              <span>৳{subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("common.delivery")}</span>
              <span>{t("checkout.digital.shippingNotApplicable")}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t("checkout.discountWithCode", { code: coupon!.code })}</span>
                <span>-৳{discount.toFixed(0)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span>{t("checkout.total")}</span>
              <span className="text-lg font-bold">৳{total.toFixed(0)}</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={total > 0 && gateways.length === 0}
            className="mt-4 h-12 w-full"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {t("checkout.digital.completePurchase")}
          </Button>
        </div>
      </aside>
    </form>
  );
}
