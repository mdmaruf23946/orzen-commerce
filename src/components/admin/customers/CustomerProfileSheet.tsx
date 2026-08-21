import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerProfile } from "@/lib/customers-admin.functions";
import { upsertCustomerNote, getCustomerNote } from "@/lib/business.functions";
import { taka } from "@/lib/order-display";
import { Ban, CheckCircle2, MapPin, Phone, Mail, Clock } from "lucide-react";
import { CallButton } from "@/components/admin/calls/CallButton";
import { CallHistoryList } from "@/components/admin/calls/CallHistoryList";
import { getCallsForPhone } from "@/lib/call-center.functions";

const TAG_PRESETS = ["Trusted Customer", "Frequent Buyer", "High Return Rate", "Call Before Delivery", "VIP"];

export function CustomerProfileSheet({
  customerKey,
  initialTab,
  onOpenChange,
  onToggleBlock,
}: {
  customerKey: string | null;
  initialTab?: string;
  onOpenChange: (v: boolean) => void;
  onToggleBlock: (accountId: string, blocked: boolean) => void;
}) {
  const fn = useServerFn(getCustomerProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customer-profile", customerKey],
    queryFn: () => fn({ data: { key: customerKey! } }),
    enabled: !!customerKey,
  });
  const [tab, setTab] = useState(initialTab ?? "overview");
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab, customerKey]);

  return (
    <Sheet open={!!customerKey} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="truncate text-base">
            {isLoading ? "Loading…" : data?.name || "Customer"}
          </SheetTitle>
          {data && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {data.phone && <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${data.phone}`}><Phone className="h-3 w-3" />{data.phone}</a>}
              {data.email && <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${data.email}`}><Mail className="h-3 w-3" />{data.email}</a>}
              {data.phone && (
                <CallButton
                  phone={data.phone}
                  customerName={data.name}
                  customerId={data.account?.id ?? null}
                  variant="outline"
                  label="Call Customer"
                />
              )}
              {data.account && (
                <Button
                  size="sm"
                  variant={data.account.is_active ? "outline" : "default"}
                  className="h-7"
                  onClick={() => onToggleBlock(data.account!.id, data.account!.is_active)}
                >
                  {data.account.is_active ? <><Ban className="mr-1 h-3 w-3" />Block</> : <><CheckCircle2 className="mr-1 h-3 w-3" />Unblock</>}
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        {isLoading || !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="overflow-x-auto border-b px-2">
              <TabsList className="h-auto w-max justify-start bg-transparent p-1">
                {["overview", "orders", "returns", "addresses", "timeline", "notes"].map((t) => (
                  <TabsTrigger key={t} value={t} className="text-xs capitalize">{t}</TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Total orders" value={data.stats.total} />
                  <Stat label="Delivered" value={data.stats.delivered} />
                  <Stat label="Pending" value={data.stats.pending} />
                  <Stat label="Cancelled" value={data.stats.cancelled} />
                  <Stat label="Returned" value={data.stats.returned} />
                  <Stat label="Exchanged" value={data.stats.exchanged} />
                  <Stat label="Refunded" value={data.stats.refunded} />
                  <Stat label="Lifetime spend" value={taka(data.stats.spend)} />
                  <Stat label="Avg order value" value={taka(data.stats.aov)} />
                </div>
                <Section title="Basic information">
                  <Row k="Registered" v={data.account ? new Date(data.account.created_at).toLocaleDateString() : "Guest (no account)"} />
                  <Row k="Last login" v={data.account?.last_login_at ? new Date(data.account.last_login_at).toLocaleString() : "—"} />
                  <Row k="Last purchase" v={data.stats.lastPurchase ? new Date(data.stats.lastPurchase).toLocaleDateString() : "—"} />
                </Section>
                <Section title="Analytics">
                  <Row k="Total saved (discounts)" v={taka(data.analytics.saved)} />
                  <Row k="Preferred payment" v={data.analytics.payment ?? "—"} />
                  <Row k="Preferred courier" v={data.analytics.courier ?? "—"} />
                  <Row k="Purchase frequency" v={data.analytics.frequencyDays ? `every ~${data.analytics.frequencyDays} days` : "—"} />
                  <Row k="Favourite categories" v={data.analytics.favCategories.map((c) => c.label).join(", ") || "—"} />
                  <Row k="Favourite products" v={data.analytics.favProducts.map((c) => c.label).join(", ") || "—"} />
                </Section>
                <Section title="Call history">
                  <CustomerCalls phone={data.phone} />
                </Section>
              </TabsContent>

              <TabsContent value="orders" className="mt-0 space-y-2">
                {data.orders.length === 0 && <Empty text="No orders yet." />}
                {data.orders.map((o) => (
                  <div key={o.id} className="rounded-xl border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{o.invoice_no ?? `#${o.id.slice(0, 8)}`}</span>
                      <Badge variant="secondary" className="capitalize">{o.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className="font-medium text-foreground">{taka(o.amount)}</span>
                      <span className="uppercase">{o.payment_method ?? "—"}</span>
                      {o.courier_name && <span>{o.courier_name}{o.courier_tracking_id ? ` · ${o.courier_tracking_id}` : ""}</span>}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="returns" className="mt-0 space-y-2">
                {data.returns.length === 0 && <Empty text="No returns or exchanges." />}
                {data.returns.map((r) => (
                  <div key={r.id} className="rounded-xl border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">{r.kind ?? r.type}</span>
                      <Badge variant="secondary" className="capitalize">{r.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      {r.refund_amount > 0 && <span>Refund {taka(r.refund_amount)}</span>}
                      {r.replacement_order_id && <span>Replacement #{r.replacement_order_id.slice(0, 8)}</span>}
                      {r.courier_tracking_id && <span>{r.courier_name} · {r.courier_tracking_id}</span>}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="addresses" className="mt-0 space-y-2">
                {data.addresses.length === 0 && data.orderAddresses.length === 0 && <Empty text="No addresses on file." />}
                {data.addresses.map((a: any) => (
                  <div key={a.id} className="rounded-xl border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{a.label || a.name || "Address"}</span>
                      {a.is_default && <Badge className="h-5 text-[10px]">Default</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.address}{a.area ? `, ${a.area}` : ""}</p>
                  </div>
                ))}
                {data.orderAddresses.map((a, i) => (
                  <div key={i} className="rounded-xl border border-dashed bg-card p-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">From order · {new Date(a.from).toLocaleDateString()}</div>
                    <p className="mt-1 text-xs">{a.address}{a.area ? `, ${a.area}` : ""}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                {data.timeline.length === 0 ? <Empty text="No activity yet." /> : (
                  <ol className="relative space-y-3 border-l pl-4">
                    {data.timeline.map((t, i) => (
                      <li key={i} className="text-sm">
                        <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                        <div className="font-medium">{t.label}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(t.at).toLocaleString()}{t.detail ? ` · ${t.detail}` : ""}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <NotesPanel phone={data.phone} initial={data.note} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NotesPanel({ phone, initial }: { phone: string; initial: { tags: string[]; note: string } }) {
  const get = useServerFn(getCustomerNote);
  const save = useServerFn(upsertCustomerNote);
  const qc = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ["customer-note", phone],
    queryFn: () => get({ data: { phone } }),
    enabled: !!phone,
  });
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [note, setNote] = useState(initial.note);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) { setTags((existing as any).tags ?? []); setNote((existing as any).note ?? ""); }
  }, [existing]);

  const toggle = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  async function submit() {
    if (!phone) return toast.error("This customer has no phone number");
    setSaving(true);
    try {
      await save({ data: { phone, tags, note } });
      qc.invalidateQueries({ queryKey: ["customer-note", phone] });
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Tags</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from(new Set([...TAG_PRESETS, ...tags])).map((t) => (
            <button key={t} onClick={() => toggle(t)}
              className={`rounded-full border px-3 py-1 text-xs transition ${tags.includes(t) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input className="h-9" placeholder="Custom tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => { if (newTag.trim()) { toggle(newTag.trim()); setNewTag(""); } }}>Add</Button>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Private note</div>
        <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" placeholder="Visible to store admins only" />
      </div>
      <Button onClick={submit} disabled={saving} className="w-full">{saving ? "Saving…" : "Save notes"}</Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Recent calls with this customer, matched by phone. */
function CustomerCalls({ phone }: { phone: string | null | undefined }) {
  const listFn = useServerFn(getCallsForPhone);
  const { data } = useQuery({
    queryKey: ["phone-calls", phone],
    queryFn: () => listFn({ data: { phone: phone! } }),
    enabled: !!phone,
  });
  if (!phone) return <div className="text-xs text-muted-foreground">No phone number on file</div>;
  return <CallHistoryList calls={(data ?? []) as any} />;
}
