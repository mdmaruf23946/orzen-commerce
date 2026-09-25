import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LockKeyhole, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { getFastCheckout, submitFastCheckout } from "@/lib/fast-checkout.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const searchSchema = (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" });
const checkoutQuery = (token: string) => queryOptions({ queryKey: ["fast-checkout", token], queryFn: () => getFastCheckout({ data: { token } }) });

export const Route = createFileRoute("/checkout/fast")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(checkoutQuery(deps.token)),
  head: () => ({ meta: [
    { title: "Secure Checkout — ORZEN" },
    { name: "description", content: "Complete your order securely through ORZEN." },
    { property: "og:title", content: "Secure Checkout — ORZEN" },
    { property: "og:description", content: "Complete your order securely through ORZEN." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  errorComponent: () => <CheckoutUnavailable />,
  notFoundComponent: () => <CheckoutUnavailable />,
  component: FastCheckoutPage,
});

function CheckoutUnavailable() {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5"><div className="max-w-sm text-center"><LockKeyhole className="mx-auto h-10 w-10 text-muted-foreground"/><h1 className="mt-4 text-xl font-semibold">Checkout link আর সক্রিয় নেই</h1><p className="mt-2 text-sm text-muted-foreground">নতুন Buy Now link পেতে আবার Messenger বা WhatsApp-এ ফিরে যান।</p></div></main>;
}

function FastCheckoutPage() {
  const { token } = Route.useSearch();
  const { data } = useSuspenseQuery(checkoutQuery(token));
  const submit = useServerFn(submitFastCheckout);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [method, setMethod] = useState("");
  const [txnId, setTxnId] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState<string | null>(null);

  useEffect(() => {
    if (!data.available) return;
    const defaultZone = data.zones.find((zone) => zone.isDefault) ?? data.zones[0];
    if (defaultZone && !zoneId) setZoneId(defaultZone.id);
    if (data.methods[0] && !method) setMethod(data.methods[0].id);
  }, [data, method, zoneId]);

  const selectedZone = data.available ? data.zones.find((zone) => zone.id === zoneId) : undefined;
  const total = useMemo(() => data.available ? data.product.price * data.quantity + Number(selectedZone?.charge ?? 0) : 0, [data, selectedZone]);
  if (!data.available) return <CheckoutUnavailable />;
  if (complete) return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5"><div className="max-w-sm text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-primary"/><h1 className="mt-4 text-2xl font-semibold">অর্ডার গ্রহণ করা হয়েছে</h1><p className="mt-2 text-muted-foreground">অর্ডার নম্বর: <strong className="text-foreground">{complete.slice(0, 8).toUpperCase()}</strong></p><p className="mt-4 text-sm text-muted-foreground">Confirmation message আপনার chat-এ পাঠানো হয়েছে। এই window বন্ধ করতে পারেন।</p></div></main>;

  const selectedMethod = data.methods.find((item) => item.id === method);
  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await submit({ data: { token, customerName: name, phone, email: email.trim() || undefined, address, area: area.trim() || undefined, deliveryZoneId: zoneId || undefined, paymentMethod: method, txnId: selectedMethod?.manual ? txnId : undefined } });
      if (result.warning) toast.warning(result.warning);
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      setComplete(result.orderId);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10"><div className="mx-auto max-w-lg overflow-hidden rounded-lg border bg-background shadow-sm"><header className="border-b px-5 py-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-medium uppercase text-muted-foreground">Secure checkout</p><h1 className="text-xl font-semibold">{data.store.name}</h1></div><LockKeyhole className="h-5 w-5 text-primary"/></div></header><section className="flex gap-4 border-b bg-muted/20 p-5">{data.product.imageUrl ? <img src={data.product.imageUrl} alt={data.product.name} className="h-20 w-20 rounded-md border object-cover"/> : <div className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted"><ShoppingBag className="h-7 w-7 text-muted-foreground"/></div>}<div className="min-w-0 flex-1"><h2 className="font-semibold">{data.product.name}</h2><p className="mt-1 text-sm text-muted-foreground">পরিমাণ: {data.quantity}</p><p className="mt-2 text-lg font-semibold">৳{data.product.price.toFixed(0)}</p></div></section><form onSubmit={onSubmit} className="space-y-5 p-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="fc-name">নাম</Label><Input id="fc-name" required autoComplete="name" value={name} onChange={(e)=>setName(e.target.value)}/></div><div className="space-y-1.5"><Label htmlFor="fc-phone">ফোন নম্বর</Label><Input id="fc-phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(e.target.value)}/></div></div><div className="space-y-1.5"><Label htmlFor="fc-email">ইমেইল (অপশনাল)</Label><Input id="fc-email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)}/></div><div className="space-y-1.5"><Label htmlFor="fc-address">ডেলিভারি ঠিকানা</Label><Input id="fc-address" required autoComplete="street-address" value={address} onChange={(e)=>setAddress(e.target.value)}/></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="fc-area">এলাকা / জেলা</Label><Input id="fc-area" value={area} onChange={(e)=>setArea(e.target.value)}/></div>{data.zones.length > 0 && <div className="space-y-1.5"><Label>ডেলিভারি জোন</Label><Select value={zoneId} onValueChange={setZoneId}><SelectTrigger><SelectValue placeholder="জোন বাছুন"/></SelectTrigger><SelectContent>{data.zones.map((zone)=><SelectItem key={zone.id} value={zone.id}>{zone.name} — ৳{zone.charge}</SelectItem>)}</SelectContent></Select></div>}</div><div className="space-y-2"><Label>পেমেন্ট মাধ্যম</Label><div className="grid gap-2">{data.methods.map((item)=><label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name="payment" value={item.id} checked={method===item.id} onChange={()=>setMethod(item.id)} className="mt-1 accent-primary"/><span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.detail}</span></span></label>)}</div></div>{selectedMethod?.manual && <div className="space-y-1.5"><Label htmlFor="fc-txn">Transaction ID</Label><Input id="fc-txn" required value={txnId} onChange={(e)=>setTxnId(e.target.value)}/></div>}<div className="border-t pt-4"><div className="flex justify-between text-sm"><span>মোট</span><strong className="text-lg">৳{total.toFixed(0)}</strong></div><Button type="submit" size="lg" className="mt-4 w-full" disabled={busy || !method}>{busy ? "অর্ডার হচ্ছে…" : selectedMethod?.online ? "পেমেন্টে এগিয়ে যান" : "অর্ডার কনফার্ম করুন"}</Button><p className="mt-3 text-center text-xs text-muted-foreground">OTP, PIN বা card details কখনো এখানে চাওয়া হবে না।</p></div></form></div></main>;
}