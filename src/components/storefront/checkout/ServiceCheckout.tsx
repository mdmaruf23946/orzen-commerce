// Dedicated Service Checkout — completely independent from physical, digital
// and subscription checkout. No address, no delivery zone, no courier, no COD.
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  getPublicServiceCheckoutConfig,
  uploadServiceFile,
  removeServiceFile,
} from "@/lib/service-checkout.functions";
import {
  CONTACT_CHANNELS,
  CONTACT_TIMES,
  SERVICE_MANUAL_METHODS,
  advanceAmount,
  type ServiceIntakeField,
} from "@/lib/service-checkout";
import { removeSelected, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCustomerSession } from "@/lib/customer-session";
import { computeFingerprint, getDeviceId } from "@/lib/fingerprint";
import {
  BriefcaseBusiness,
  Clock,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";

export type ServiceCartInfo = Record<
  string,
  {
    packages: any[];
    addons: any[];
    delivery: any;
    pricing_type: string;
    availability: string;
    allow_quantity: boolean;
  } | null
>;

type Props = {
  slug: string;
  store: any;
  items: CartItem[];
  info: ServiceCartInfo;
  images?: Record<string, string | null>;
};

function newToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

export function ServiceCheckout({ slug, store, items, info, images = {} }: Props) {
  const { t } = useStoreT();
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const startPay = useServerFn(startOnlineCheckout);
  const valCoupon = useServerFn(validateCoupon);
  const listGw = useServerFn(listStoreOnlineGateways);
  const getConfig = useServerFn(getPublicServiceCheckoutConfig);
  const upload = useServerFn(uploadServiceFile);
  const removeFile = useServerFn(removeServiceFile);
  const { customer, token: customerToken } = useCustomerSession(slug);

  const main = items[0];
  const svc = main ? info[main.productId] : null;

  const { data: gateways = [] } = useQuery({
    enabled: !!store?.id,
    queryKey: ["onlineGateways", store?.id],
    queryFn: () => listGw({ data: { storeId: store.id } }),
  });
  const { data: config } = useQuery({
    enabled: !!store?.id,
    queryKey: ["serviceCheckoutConfig", store?.id],
    queryFn: () => getConfig({ data: { storeId: store.id } }),
  });
  const settings = config?.settings;
  const fields = (config?.fields ?? []) as ServiceIntakeField[];

  const uploadToken = useRef(newToken());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<{ id: string; file_name: string; size_bytes: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [channel, setChannel] = useState<string>("");
  const [contactTime, setContactTime] = useState<string>("");
  const [pkgKey, setPkgKey] = useState<string>("");
  const [addons, setAddons] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [method, setMethod] = useState("");
  const [txnId, setTxnId] = useState("");
  const [plan, setPlan] = useState<"full" | "advance">("full");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<"idle" | "creating" | "redirecting">("idle");

  const packages: any[] = svc?.packages ?? [];
  const selectedPkg =
    packages.find((p) => (p.key ?? p.name) === pkgKey) ?? (packages.length ? packages[0] : null);

  useEffect(() => {
    if (!pkgKey && packages.length) setPkgKey(packages[0].key ?? packages[0].name);
  }, [packages, pkgKey]);

  useEffect(() => {
    if (customer) {
      if (!name && customer.full_name) setName(customer.full_name);
      if (!phone && customer.phone) setPhone(customer.phone);
      if (!email && (customer as any).email) setEmail((customer as any).email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  // Only the methods the store owner enabled for services are offered.
  const methods = useMemo(() => {
    const allowed = settings?.payment_methods ?? [];
    const pc = (store as any)?.payments_config ?? {};
    const list: { id: string; label: string; desc: string; online: boolean; logo?: string | null }[] = [];
    for (const g of gateways as any[]) {
      if (allowed.length && !allowed.includes(g.key)) continue;
      list.push({
        id: g.key,
        label: g.label,
        desc: g.sandbox ? t("checkout.payOnlineTest") : t("checkout.payOnlineSecure"),
        online: true,
        logo: g.logo_url,
      });
    }
    for (const m of SERVICE_MANUAL_METHODS) {
      if (allowed.length && !allowed.includes(m.id)) continue;
      const cfg = pc[m.id];
      if (!cfg || cfg.enabled === false) continue;
      const detail = cfg.number || cfg.account;
      if (!detail) continue;
      list.push({
        id: m.id,
        label: m.label,
        desc: `Send to ${detail}`,
        online: false,
      });
    }
    return list;
  }, [gateways, settings, store]);

  useEffect(() => {
    if (!methods.length) return;
    const preferred = settings?.default_payment_method;
    if (!method || !methods.find((m) => m.id === method)) {
      setMethod(methods.find((m) => m.id === preferred)?.id ?? methods[0].id);
    }
  }, [methods, settings, method]);

  useEffect(() => {
    if (settings?.payment_mode === "advance_required") setPlan("advance");
  }, [settings?.payment_mode]);

  const basePrice = selectedPkg?.price != null ? Number(selectedPkg.price) : (main?.price ?? 0);
  const qty = svc?.allow_quantity ? (main?.qty ?? 1) : 1;
  const addonTotal = (svc?.addons ?? [])
    .filter((a: any) => addons.includes(a.name))
    .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
  const subtotal = basePrice * qty + addonTotal;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const wantsAdvance =
    settings?.payment_mode === "advance_required" ||
    (settings?.payment_mode === "advance" && plan === "advance");
  const payNow = settings && wantsAdvance ? advanceAmount(total, settings) : total;
  const busy = stage !== "idle";
  const isOnline = method.startsWith("custom:") || method.startsWith("builtin:");

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setApplying(true);
    try {
      const res = await valCoupon({ data: { storeId: store.id, code: couponCode.trim(), subtotal } });
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

  async function onPickFiles(list: FileList | null) {
    if (!list?.length || !settings) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        if (files.length >= settings.upload_max_files) {
          toast.error(t("checkout.service.filesHint", { max: settings.upload_max_files, mb: settings.upload_max_mb, types: "" }));
          break;
        }
        const base64 = await fileToBase64(f);
        const rec = await upload({
          data: {
            storeId: store.id,
            uploadToken: uploadToken.current,
            fileName: f.name,
            mimeType: f.type || undefined,
            base64,
          },
        });
        setFiles((prev) => [...prev, rec as any]);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function dropFile(id: string) {
    try {
      await removeFile({ data: { id, uploadToken: uploadToken.current } });
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      /* ignore */
    }
  }

  const termsList = [
    { key: "terms", label: t("footer.terms"), to: "/terms" },
    { key: "refund", label: t("footer.returnPolicy"), to: "/refund-policy" },
    { key: "service", label: t("footer.terms"), to: "/terms" },
    { key: "privacy", label: t("footer.privacy"), to: "/privacy-policy" },
  ].filter((term) => (settings?.terms as any)?.[term.key] !== false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields) {
      if (f.is_required && !String(answers[f.field_key] ?? "").trim()) {
        toast.error(t("checkout.service.fieldRequired", { label: f.label }));
        return;
      }
    }
    if (termsList.some((term) => !accepted[term.key])) {
      toast.error(t("checkout.service.acceptPolicies"));
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
          paymentMethod: total > 0 ? method : "bank",
          txnId: !isOnline && txnId ? txnId : undefined,
          items: items.map((i) => ({ productId: i.productId, qty: svc?.allow_quantity ? i.qty : 1 })),
          couponCode: coupon?.code,
          customerToken: customerToken ?? undefined,
          fingerprint: fingerprint || undefined,
          deviceId: deviceId || undefined,
          service: {
            packageKey: selectedPkg ? (selectedPkg.key ?? selectedPkg.name) : undefined,
            addons,
            answers,
            website: website || undefined,
            businessName: businessName || undefined,
            language: language || undefined,
            contactChannel: channel || undefined,
            contactTime: contactTime || undefined,
            uploadToken: uploadToken.current,
            paymentPlan: wantsAdvance ? "advance" : "full",
          },
        },
      });
      if ((res as any)?.warning) toast.warning((res as any).warning);

      // Remember the contact used at checkout so the order page can prove
      // ownership without asking the shopper to retype phone/email.
      try {
        const proof = (phone || email || "").trim();
        if (proof && res?.orderId) {
          window.localStorage.setItem(`orzen_order_contact__${res.orderId}`, proof);
        }
      } catch {
        /* storage unavailable */
      }

      if (total > 0 && isOnline) {
        setStage("redirecting");
        const pay = await startPay({ data: { orderId: res.orderId, gatewayKey: method } });
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
          {stage === "creating" ? t("checkout.service.creatingOrder") : t("checkout.digital.openingPayment")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("checkout.dontCloseRefresh")}</p>
      </div>
    );
  }

  const cf = settings?.customer_fields ?? {};
  const deliveryTime =
    selectedPkg?.delivery_time ??
    (svc?.delivery?.time ? `${svc.delivery.time} ${svc.delivery.unit ?? "days"}` : null);

  return (
    <form onSubmit={submit} className="grid gap-6 sm:grid-cols-5">
      <div className="space-y-5 sm:col-span-3">
        <div>
          <h1 className="text-xl font-semibold">{t("checkout.service.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("checkout.service.subtitle")}
          </p>
        </div>

        {/* Package selection */}
        {packages.length > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.choosePackage")}</h2>
            <div className="mt-3 grid gap-2">
              {packages.map((p: any) => {
                const key = p.key ?? p.name;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                      pkgKey === key ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="svc-package"
                      className="mt-1"
                      checked={pkgKey === key}
                      onChange={() => setPkgKey(key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-sm font-semibold">৳{Number(p.price ?? 0).toFixed(0)}</span>
                      </span>
                      {p.summary ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{p.summary}</span>
                      ) : null}
                      <span className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {p.delivery_time ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {p.delivery_time}
                          </span>
                        ) : null}
                        {p.revisions ? (
                          <span className="inline-flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" /> {t("checkout.service.revisions", { n: p.revisions })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Add-ons */}
        {(svc?.addons ?? []).length > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.addonServices")}</h2>
            <div className="mt-3 space-y-2">
              {(svc?.addons ?? []).map((a: any) => (
                <label key={a.name} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={addons.includes(a.name)}
                    onCheckedChange={(v) =>
                      setAddons((prev) => (v === true ? [...prev, a.name] : prev.filter((x) => x !== a.name)))
                    }
                  />
                  <span className="flex-1">
                    <span className="font-medium">{a.name}</span>
                    {a.description ? (
                      <span className="block text-xs text-muted-foreground">{a.description}</span>
                    ) : null}
                  </span>
                  <span className="text-sm">+৳{Number(a.price ?? 0).toFixed(0)}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Customer information */}
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.service.yourInfo")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">{t("common.fullName")} *</Label>
              <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">{t("checkout.mobileNumber")}</Label>
              <Input id="s-phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-email">{t("checkout.emailAddress")}</Label>
              <Input
                id="s-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {cf.company !== false && (
              <div className="space-y-1.5">
                <Label htmlFor="s-company">{t("checkout.companyName")}</Label>
                <Input id="s-company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            )}
            {cf.business_name && (
              <div className="space-y-1.5">
                <Label htmlFor="s-biz">{t("checkout.service.businessName")}</Label>
                <Input id="s-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
            )}
            {cf.website !== false && (
              <div className="space-y-1.5">
                <Label htmlFor="s-web">{t("checkout.service.websiteUrl")}</Label>
                <Input
                  id="s-web"
                  placeholder="https://"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            )}
            {cf.country !== false && (
              <div className="space-y-1.5">
                <Label htmlFor="s-country">{t("checkout.subscription.country")}</Label>
                <Input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            )}
            {cf.language && (
              <div className="space-y-1.5">
                <Label htmlFor="s-lang">{t("checkout.service.preferredLanguage")}</Label>
                <Input id="s-lang" value={language} onChange={(e) => setLanguage(e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {/* Project requirements */}
        {fields.length > 0 && (
          <section className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.projectRequirements")}</h2>
            {fields.map((f) => (
              <IntakeField
                key={f.id}
                field={f}
                value={answers[f.field_key]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [f.field_key]: v }))}
              />
            ))}
          </section>
        )}

        {/* File upload */}
        {(settings?.upload_max_files ?? 0) > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.projectFiles")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("checkout.service.filesHint", {
                max: settings?.upload_max_files ?? 0,
                mb: settings?.upload_max_mb ?? 0,
                types: (settings?.upload_allowed_types ?? []).join(", "),
              })}
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              {uploading ? t("checkout.service.uploading") : t("checkout.service.attachFiles")}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                    <button type="button" onClick={() => dropFile(f.id)} aria-label={t("checkout.service.removeFile")}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Communication preferences */}
        {settings?.communication_enabled !== false && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.commPrefs")}</h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">{t("checkout.service.preferredChannel")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CONTACT_CHANNELS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(channel === c ? "" : c)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        channel === c ? "border-primary bg-primary/10 font-medium" : ""
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("checkout.service.preferredContactTime")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CONTACT_TIMES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setContactTime(contactTime === c ? "" : c)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        contactTime === c ? "border-primary bg-primary/10 font-medium" : ""
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Payment */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.service.payment")}</h2>
          {settings?.payment_mode === "advance" && total > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(["full", "advance"] as const).map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${
                    plan === p ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input type="radio" name="svc-plan" checked={plan === p} onChange={() => setPlan(p)} />
                  <span>
                    {p === "full"
                      ? t("checkout.service.payInFull")
                      : t("checkout.service.payAdvancePercent", { percent: settings?.min_advance_percent })}
                  </span>
                </label>
              ))}
            </div>
          )}
          {settings?.payment_mode === "advance_required" && total > 0 && (
            <p className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
              {t("checkout.service.advanceRequired", { percent: settings.min_advance_percent })}
            </p>
          )}
          {total === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("checkout.service.freeBooking")}</p>
          ) : methods.length === 0 ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {t("checkout.service.noMethod")}
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                    method === m.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="svc-method"
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  {m.logo ? <img src={m.logo} alt="" className="h-6 w-auto" /> : null}
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {total > 0 && !isOnline && method ? (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="svc-txn">{t("checkout.transactionId")}</Label>
              <Input id="svc-txn" required value={txnId} onChange={(e) => setTxnId(e.target.value)} />
            </div>
          ) : null}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t("checkout.service.noCod")}
          </p>
        </section>

        {/* Terms */}
        {termsList.length > 0 && (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("checkout.service.agreements")}</h2>
            {termsList.map((term) => (
              <label key={term.key} className="flex items-start gap-3 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={!!accepted[term.key]}
                  onCheckedChange={(v) => setAccepted((prev) => ({ ...prev, [term.key]: v === true }))}
                />
                <span>
                  {t("checkout.service.acceptPrefix")}{" "}
                  <Link to={term.to} className="underline">
                    {term.label}
                  </Link>
                  .
                </span>
              </label>
            ))}
          </section>
        )}
      </div>

      {/* Summary */}
      <aside className="sm:col-span-2">
        <div className="sticky top-20 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("checkout.orderSummary")}</h2>
          <div className="mt-3 flex gap-3">
            {images[main?.productId ?? ""] || main?.image ? (
              <img
                src={(images[main.productId] || main.image) as string}
                alt={main?.name}
                className="h-16 w-16 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border bg-muted">
                <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{main?.name}</p>
              {selectedPkg ? (
                <p className="text-xs text-muted-foreground">{t("checkout.service.package", { name: selectedPkg.name })}</p>
              ) : null}
              <p className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {deliveryTime ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {deliveryTime}
                  </span>
                ) : null}
                {selectedPkg?.revisions ? (
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> {t("checkout.service.revisions", { n: selectedPkg.revisions })}
                  </span>
                ) : null}
              </p>
            </div>
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
                <X className="h-3.5 w-3.5" />
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
              <span>{t("checkout.service.basePrice")}</span>
              <span>৳{(basePrice * qty).toFixed(0)}</span>
            </div>
            {addonTotal > 0 && (
              <div className="flex justify-between">
                <span>{t("checkout.service.addons")}</span>
                <span>৳{addonTotal.toFixed(0)}</span>
              </div>
            )}
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
            {wantsAdvance && total > 0 && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("checkout.service.payNowAdvance")}</span>
                  <span>৳{payNow.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("checkout.service.balanceDueLater")}</span>
                  <span>৳{(total - payNow).toFixed(0)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("checkout.service.paymentStatus")}</span>
              <span>{t("checkout.service.unpaid")}</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={total > 0 && methods.length === 0}
            className="mt-4 h-12 w-full"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {t("checkout.service.continueToPayment")}
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> {t("checkout.service.secureBooking")}
          </p>
        </div>
      </aside>
    </form>
  );
}

function IntakeField({
  field,
  value,
  onChange,
}: {
  field: ServiceIntakeField;
  value: any;
  onChange: (v: any) => void;
}) {
  const { t } = useStoreT();
  const id = `svc-f-${field.id}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.is_required ? " *" : ""}
    </Label>
  );
  const help = field.help_text ? (
    <p className="text-xs text-muted-foreground">{field.help_text}</p>
  ) : null;

  if (field.field_type === "long_text") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          id={id}
          rows={4}
          placeholder={field.placeholder ?? ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {help}
      </div>
    );
  }
  if (field.field_type === "dropdown") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={id}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("checkout.service.selectPlaceholder")}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {help}
      </div>
    );
  }
  if (field.field_type === "radio") {
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => (
            <label
              key={o}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                value === o ? "border-primary bg-primary/10 font-medium" : ""
              }`}
            >
              <input
                type="radio"
                className="hidden"
                name={id}
                checked={value === o}
                onChange={() => onChange(o)}
              />
              {o}
            </label>
          ))}
        </div>
        {help}
      </div>
    );
  }
  if (field.field_type === "checkbox") {
    return (
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={value === true || value === "yes"}
          onCheckedChange={(v) => onChange(v === true ? "yes" : "")}
        />
        <span>
          {field.label}
          {field.is_required ? " *" : ""}
          {field.help_text ? (
            <span className="block text-xs text-muted-foreground">{field.help_text}</span>
          ) : null}
        </span>
      </label>
    );
  }

  const type =
    field.field_type === "date"
      ? "date"
      : field.field_type === "number"
        ? "number"
        : field.field_type === "url"
          ? "url"
          : "text";
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={id}
        type={type}
        placeholder={field.placeholder ?? ""}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {help}
    </div>
  );
}
