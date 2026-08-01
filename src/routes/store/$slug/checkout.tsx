import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStoreBySlug, listStoreOnlineGateways, startOnlineCheckout, placeOrder, validateCoupon, getStoreDeliveryZones } from "@/lib/storefront.functions";
import { readCart, clearCart, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerSession } from "@/lib/customer-session";
import { computeFingerprint, getDeviceId } from "@/lib/fingerprint";
import { fbTrack } from "@/lib/fb-track";
import { storeMode } from "@/lib/digital";
import { listProductsByIds } from "@/lib/storefront.functions";


const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

export const Route = createFileRoute("/store/$slug/checkout")({
  head: () => ({ meta: [{ title: "Checkout" }] }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(storeQuery(params.slug));
    return null;
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const place = useServerFn(placeOrder);
  const valCoupon = useServerFn(validateCoupon);
  const listGw = useServerFn(listStoreOnlineGateways);
  const startPay = useServerFn(startOnlineCheckout);
  const getZones = useServerFn(getStoreDeliveryZones);
  const { data: onlineGateways = [] } = useQuery({
    enabled: !!store?.id,
    queryKey: ["onlineGateways", store?.id],
    queryFn: () => listGw({ data: { storeId: store!.id } }),
  });
  const { data: zones = [] } = useQuery({
    enabled: !!store?.id,
    queryKey: ["deliveryZones", store?.id],
    queryFn: () => getZones({ data: { storeId: store!.id } }),
  });

  const { customer, token: customerToken } = useCustomerSession(slug);
  const requireLogin = !!(store as any)?.require_customer_login;

  type PM = string;
  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [method, setMethod] = useState<PM>("cod");
  const [txnId, setTxnId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShipping: boolean } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    const c = readCart(slug);
    setItems(c);
    if (c.length) {
      fbTrack("InitiateCheckout", {
        content_ids: c.map((i) => i.productId),
        contents: c.map((i) => ({ id: i.productId, quantity: i.qty, item_price: i.price })),
        num_items: c.reduce((a, i) => a + i.qty, 0),
        value: c.reduce((a, i) => a + i.qty * i.price, 0),
        currency: "BDT",
      });
    }
  }, [slug]);

  // Prefill from signed-in customer profile
  useEffect(() => {
    if (customer) {
      if (!name && customer.full_name) setName(customer.full_name);
      if (!phone && customer.phone) setPhone(customer.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  // Digital carts skip everything shipping-related.
  const cartIds = items.map((i) => i.productId).slice(0, 24);
  const { data: cartProducts = [] } = useQuery({
    enabled: !!store?.id && cartIds.length > 0,
    queryKey: ["cartProductTypes", store?.id, cartIds.join(",")],
    queryFn: () => listProductsByIds({ data: { storeId: store!.id, ids: cartIds } }),
  });

  // Auto-select default zone when zones load
  useEffect(() => {
    if (!zoneId && zones.length > 0) {
      const def = zones.find((z: any) => z.is_default) ?? zones[0];
      setZoneId(def.id);
    }
  }, [zones, zoneId]);


  if (!store) return null;
  const s: any = store;
  const mode = storeMode(s.store_mode);
  const digitalOnly =
    mode === "digital" ||
    (mode === "hybrid" &&
      cartIds.length > 0 &&
      cartProducts.length === cartIds.length &&
      cartProducts.every((p: any) => p.product_type === "digital"));
  const pc = s.payments_config ?? {};
  const delivery = s.delivery ?? {};
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const freeMin = Number(delivery.free_min ?? 0);
  const selectedZone = zones.find((z: any) => z.id === zoneId) ?? null;
  const baseShip = selectedZone ? Number(selectedZone.charge) : 0;
  let shipping = digitalOnly ? 0 : freeMin > 0 && subtotal >= freeMin ? 0 : baseShip;
  if (coupon?.freeShipping) shipping = 0;
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await valCoupon({ data: { storeId: store!.id, code: couponCode.trim(), subtotal } });
      if (!res.ok) { toast.error(res.error); setCoupon(null); }
      else { setCoupon({ code: res.code, discount: res.discount, freeShipping: res.freeShipping }); toast.success("Coupon applied"); }
    } catch (err) { toast.error((err as Error).message); }
    finally { setApplyingCoupon(false); }
  }


  const methods: {
    id: PM;
    label: string;
    desc: string;
    online?: boolean;
    logo?: string | null;
    sandbox?: boolean;
  }[] = [];
  // Online gateways connected by the store owner come first.
  for (const g of onlineGateways as any[]) {
    methods.push({
      id: g.key,
      label: g.label,
      desc: g.sandbox ? "Pay online (sandbox)" : "Pay online securely",
      online: true,
      logo: g.logo_url,
      sandbox: !!g.sandbox,
    });
  }
  if (pc.cod?.enabled !== false) methods.push({ id: "cod", label: "Cash on Delivery", desc: "Pay when you receive" });
  // Manual numbers come only from payments_config so removing a number in the
  // admin panel immediately hides it at checkout.
  const bk = pc.bkash?.number;
  if (pc.bkash?.enabled !== false && bk) methods.push({ id: "bkash", label: "bKash", desc: `Send to ${bk}` });
  const ng = pc.nagad?.number;
  if (pc.nagad?.enabled !== false && ng) methods.push({ id: "nagad", label: "Nagad", desc: `Send to ${ng}` });
  if (pc.rocket?.enabled && pc.rocket?.number) methods.push({ id: "rocket", label: "Rocket", desc: `Send to ${pc.rocket.number}` });
  if (pc.bank?.enabled && pc.bank?.account)
    methods.push({ id: "bank", label: "Bank Transfer", desc: `${pc.bank.name ?? ""} ${pc.bank.account}`.trim() });

  // Ensure selected method is still available
  useEffect(() => {
    if (methods.length && !methods.find((m) => m.id === method)) setMethod(methods[0].id);
  }, [methods.map((m) => m.id).join(","), method]);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Your cart is empty</h1>
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Continue shopping
        </Link>
      </div>
    );
  }

  if (requireLogin && !customer) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">Sign in to continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This store requires a customer account before placing an order.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/store/$slug/auth/login"
            params={{ slug }}
            search={{ redirect: `/store/${slug}/checkout` }}
            className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--primary)" }}
          >
            Sign in
          </Link>
          <Link
            to="/store/$slug/auth/signup"
            params={{ slug }}
            search={{ redirect: `/store/${slug}/checkout` }}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const isOnlineMethod = method.startsWith("custom:") || method.startsWith("builtin:");
  const isManual = !isOnlineMethod && method !== "cod";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const [fingerprint, deviceId] = [await computeFingerprint(), getDeviceId()];
      const res = await place({
        data: {
          storeId: store!.id,
          customerName: name,
          phone,
          address: digitalOnly ? address || "Digital delivery" : address,
          area: area || undefined,
          paymentMethod: method,
          txnId: isManual ? txnId : undefined,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          couponCode: coupon?.code,
          deliveryZoneId: digitalOnly ? undefined : zoneId ?? undefined,
          customerToken: customerToken ?? undefined,
          fingerprint: fingerprint || undefined,
          deviceId: deviceId || undefined,
        },
      });

      if ((res as any)?.warning) toast.warning((res as any).warning);

      if (isOnlineMethod) {
        // Hand the shopper over to the payment gateway BEFORE emptying the
        // cart, so a failed session leaves them able to retry.
        const pay = await startPay({ data: { orderId: res.orderId, gatewayKey: method } });
        if (pay?.redirect_url) {
          clearCart(slug);
          window.location.href = pay.redirect_url;
          return;
        }
        throw new Error("Payment could not be started. Please try another payment method.");
      }

      clearCart(slug);
      navigate({ to: "/store/$slug/order/$orderId", params: { slug, orderId: res.orderId } });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg && msg.toLowerCase().includes("already ordered")) {
        toast.error(msg, { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 sm:grid-cols-5">
      <div className="sm:col-span-3">
        <h1 className="text-xl font-semibold">Checkout</h1>
        <div className="mt-4 space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {digitalOnly ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              This is a digital order — no shipping address needed. Your files unlock right after
              the payment is confirmed.
            </div>
          ) : (
            <>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Delivery area (optional)</Label>
            <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          {zones.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Delivery zone</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {zones.map((z: any) => (
                  <label
                    key={z.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${zoneId === z.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <input
                      type="radio"
                      name="zone"
                      className="mt-0.5"
                      checked={zoneId === z.id}
                      onChange={() => setZoneId(z.id)}
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{z.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        ৳{Number(z.charge).toFixed(0)}
                        {z.eta ? ` · ${z.eta}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
            </>
          )}
        </div>

        <h2 className="mt-6 text-sm font-semibold">Payment method</h2>
        {onlineGateways.length === 0 && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            No online payment gateway is configured for this store. Please use one of the manual options below.
          </div>
        )}
        <div className="mt-2 grid gap-2">
          {methods.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${method === m.id ? "border-primary bg-primary/5" : ""}`}
            >
              <input
                type="radio"
                name="method"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {m.label}
                  {m.sandbox && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Test mode
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{m.desc}</div>
              </div>

            </label>
          ))}
        </div>
        {isManual && (
          <>
            {pc.instructions && (
              <p className="mt-3 whitespace-pre-line rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {pc.instructions}
              </p>
            )}
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="txn">Transaction ID</Label>
              <Input id="txn" required value={txnId} onChange={(e) => setTxnId(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <aside className="sm:col-span-2">
        <div className="sticky top-20 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="line-clamp-1">
                  {i.name} × {i.qty}
                </span>
                <span>৳{(i.qty * i.price).toFixed(0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input placeholder="Coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="h-9" />
            {coupon ? (
              <Button type="button" size="sm" variant="outline" onClick={() => { setCoupon(null); setCouponCode(""); }}>Remove</Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={applyCoupon} disabled={applyingCoupon || !couponCode.trim()}>
                {applyingCoupon ? "…" : "Apply"}
              </Button>
            )}
          </div>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>৳{subtotal.toFixed(0)}</span></div>
            {!digitalOnly && (
              <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : `৳${shipping.toFixed(0)}`}</span></div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Discount ({coupon!.code})</span><span>-৳{discount.toFixed(0)}</span></div>
            )}
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="text-sm">Total</span>
              <span className="text-lg font-bold">৳{total.toFixed(0)}</span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || methods.length === 0}
            className="mt-4 h-12 w-full"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {submitting ? "Placing order…" : isOnlineMethod ? "Pay now" : "Confirm Order"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
