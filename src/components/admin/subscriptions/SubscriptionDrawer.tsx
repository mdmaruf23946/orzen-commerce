import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getAdminSubscription,
  adminSubscriptionAction,
  markSubscriptionInvoicePaid,
} from "@/lib/subscriptions-admin.functions";
import { CYCLE_LABEL, STATUS_LABEL, STATUS_TONE, type SubCycle, type SubStatus } from "@/lib/subscriptions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const money = (n: any) => `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (d: any) => (d ? new Date(d).toLocaleDateString() : "—");

export function SubscriptionDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const fetchOne = useServerFn(getAdminSubscription);
  const runAction = useServerFn(adminSubscriptionAction);
  const payInvoice = useServerFn(markSubscriptionInvoicePaid);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscription-detail", id],
    queryFn: () => fetchOne({ data: { id: id as string } }),
    enabled: !!id,
  });

  const sub = data?.subscription as any;

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!id) return;
    setBusy(true);
    try {
      await runAction({ data: { id, action, note: note || undefined, ...extra } as any });
      await qc.invalidateQueries({ queryKey: ["admin", "subscription-detail", id] });
      await qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(invoiceId: string) {
    setBusy(true);
    try {
      await payInvoice({ data: { invoiceId } });
      await qc.invalidateQueries({ queryKey: ["admin", "subscription-detail", id] });
      await qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      toast.success("Invoice marked paid");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            {sub?.subscription_no ?? "Subscription"}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !sub ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-4 space-y-5 pb-10">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {sub.plan_snapshot?.name ?? sub.plan_name ?? "Plan"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CYCLE_LABEL[(sub.billing_cycle as SubCycle) ?? "monthly"] ?? sub.billing_cycle} ·{" "}
                    {money(sub.renewal_price ?? sub.price)}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    STATUS_TONE[(sub.status as SubStatus)] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[(sub.status as SubStatus)] ?? sub.status}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Field label="Customer" value={sub.customer_name || sub.customer_email || "—"} />
                <Field label="Email" value={sub.customer_email || "—"} />
                <Field label="Phone" value={sub.customer_phone || "—"} />
                <Field label="Started" value={date(sub.started_at)} />
                <Field label="Period end" value={date(sub.current_period_end)} />
                <Field label="Next billing" value={date(sub.next_billing_date)} />
                <Field label="Trial ends" value={date(sub.trial_ends_at)} />
                <Field label="Auto renew" value={sub.auto_renew ? "On" : "Off"} />
              </dl>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Internal note</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason / note attached to the next action"
              />
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act("note")}>
                Save note
              </Button>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Actions</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => act("activate")}>Activate</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act("renew")}>Renew now</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act("suspend")}>Suspend</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act("resume")}>Resume</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act("cancel")}>Cancel at period end</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => act("cancel_now")}>Cancel now</Button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border p-3">
                <div className="text-xs">
                  <div className="font-medium">Auto renew</div>
                  <div className="text-muted-foreground">{sub.auto_renew ? "Currently on" : "Currently off"}</div>
                </div>
                <Switch
                  checked={!!sub.auto_renew}
                  disabled={busy}
                  onCheckedChange={(v) => act(v ? "auto_renew_on" : "auto_renew_off")}
                />
              </div>
              <div className="mt-3 flex items-end gap-2">
                <div className="w-28">
                  <Label className="text-xs">Extend (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => act("extend", { days })}>
                  Extend
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Invoices</div>
              <div className="overflow-hidden rounded-xl border">
                {(data?.invoices ?? []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No invoices yet.</div>
                ) : (
                  (data?.invoices ?? []).map((inv: any) => (
                    <div key={inv.id} className="border-b p-3 text-xs last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenInvoice(openInvoice === inv.id ? null : inv.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate font-medium">{inv.invoice_no ?? inv.id.slice(0, 8)}</div>
                          <div className="text-muted-foreground">
                            {date(inv.created_at)} · due {date(inv.due_date)} · {inv.status}
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold">{money(inv.total)}</span>
                          {inv.status !== "paid" && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => markPaid(inv.id)}>
                              Mark paid
                            </Button>
                          )}
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              openInvoice === inv.id && "rotate-180",
                            )}
                          />
                        </div>
                      </div>
                      {openInvoice === inv.id && (
                        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3">
                          <Field label="Invoice no" value={inv.invoice_no ?? "—"} />
                          <Field label="Type" value={inv.is_renewal ? "Renewal" : "Initial"} />
                          <Field label="Subtotal" value={money(inv.subtotal ?? inv.amount)} />
                          <Field label="Tax" value={money(inv.tax ?? inv.tax_amount ?? 0)} />
                          <Field label="Setup fee" value={money(inv.setup_fee ?? 0)} />
                          <Field label="Discount" value={money(inv.discount ?? 0)} />
                          <Field label="Total" value={money(inv.total)} />
                          <Field label="Status" value={String(inv.status ?? "—")} />
                          <Field label="Issued" value={date(inv.created_at)} />
                          <Field label="Due" value={date(inv.due_date)} />
                          <Field label="Paid at" value={date(inv.paid_at)} />
                          <Field label="Period" value={`${date(inv.period_start)} → ${date(inv.period_end)}`} />
                        </dl>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Timeline</div>
              <div className="space-y-2">
                {(data?.events ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No events yet.</div>
                ) : (
                  (data?.events ?? []).map((ev: any) => (
                    <div key={ev.id} className="flex gap-2 text-xs">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <span className="font-medium capitalize">{String(ev.event_type).replace(/_/g, " ")}</span>
                        {ev.message && <span className="text-muted-foreground"> — {ev.message}</span>}
                        <div className="text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
