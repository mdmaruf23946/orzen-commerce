// Full subscription controller rendered inside the Orders → order details drawer.
// This is the ONLY place subscription orders are managed in the admin panel.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  getAdminSubscriptionByOrder,
  adminSubscriptionAction,
  markSubscriptionInvoicePaid,
} from "@/lib/subscriptions-admin.functions";
import { CYCLES, CYCLE_LABEL, STATUS_LABEL, STATUS_TONE, type SubCycle, type SubStatus } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const money = (n: any) => `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (d: any) => (d ? new Date(d).toLocaleDateString() : "—");

export function SubscriptionOrderPanel({ orderId, fallback }: { orderId: string; fallback?: any }) {
  const fetchOne = useServerFn(getAdminSubscriptionByOrder);
  const runAction = useServerFn(adminSubscriptionAction);
  const payInvoice = useServerFn(markSubscriptionInvoicePaid);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [cycle, setCycle] = useState<string>("");
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscription-by-order", orderId],
    queryFn: () => fetchOne({ data: { orderId } }),
  });

  const sub = (data as any)?.subscription;

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!sub) return;
    setBusy(true);
    try {
      await runAction({ data: { id: sub.id, action, note: note || undefined, ...extra } as any });
      await qc.invalidateQueries({ queryKey: ["admin", "subscription-by-order", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["order-drawer", orderId] });
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
      await qc.invalidateQueries({ queryKey: ["admin", "subscription-by-order", orderId] });
      toast.success("Invoice marked paid");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>;

  if (!sub) {
    const f = fallback ?? {};
    return (
      <div className="space-y-2">
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">State</dt>
          <dd className="text-right capitalize">{f.subscription_state ?? "pending"}</dd>
          <dt className="text-muted-foreground">Cycle</dt>
          <dd className="text-right capitalize">{String(f.billing_cycle ?? "monthly").replace(/_/g, " ")}</dd>
          <dt className="text-muted-foreground">Renews</dt>
          <dd className="text-right">{date(f.renewal_at)}</dd>
        </dl>
        <p className="text-[11px] text-muted-foreground">
          No subscription record yet — it is created once the order is confirmed/activated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {sub.plan_snapshot?.name ?? sub.plan_name ?? "Plan"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {sub.subscription_no ? `${sub.subscription_no} · ` : ""}
              {CYCLE_LABEL[(sub.billing_cycle as SubCycle) ?? "monthly"] ?? sub.billing_cycle} ·{" "}
              {money(sub.renewal_price ?? sub.price)}
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_TONE[sub.status as SubStatus] ?? "bg-muted text-muted-foreground",
            )}
          >
            {STATUS_LABEL[sub.status as SubStatus] ?? sub.status}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Field label="Customer" value={sub.customer_name || sub.customer_email || "—"} />
          <Field label="Email" value={sub.customer_email || "—"} />
          <Field label="Phone" value={sub.customer_phone || "—"} />
          <Field label="Order date" value={date(sub.created_at)} />
          <Field label="Activated" value={date(sub.started_at)} />
          <Field label="Period end" value={date(sub.current_period_end)} />
          <Field label="Next renewal" value={date(sub.next_billing_date)} />
          <Field label="Expires" value={date(sub.expires_at)} />
          <Field label="Trial ends" value={date(sub.trial_ends_at)} />
          <Field label="Payment status" value={String(sub.payment_status ?? "—")} />
          <Field label="Auto renew" value={sub.auto_renew ? "On" : "Off"} />
          <Field label="Renewal status" value={sub.cancel_at_period_end ? "Cancels at period end" : "Scheduled"} />
        </dl>
      </div>

      {/* Actions */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Actions</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => act("activate")}>Activate</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("renew")}>Renew now</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("suspend")}>Suspend</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("resume")}>Resume</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("expire")}>Expire</Button>
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

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-24">
            <Label className="text-[11px]">Extend (days)</Label>
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

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <Label className="text-[11px]">Billing cycle</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={cycle || sub.billing_cycle || "monthly"}
              onChange={(e) => setCycle(e.target.value)}
            >
              {CYCLES.map((c) => (
                <option key={c} value={c}>{CYCLE_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => act("change_cycle", { cycle: cycle || sub.billing_cycle || "monthly" })}
          >
            Change cycle
          </Button>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-[11px]">Internal admin note</Label>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason / note attached to the next action"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("note")}>Save note</Button>
          {sub.admin_note && <span className="text-[11px] text-muted-foreground">Saved: {sub.admin_note}</span>}
        </div>
      </div>

      {/* Invoices */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
          Invoices & payment history
        </div>
        <div className="overflow-hidden rounded-lg border">
          {((data as any)?.invoices ?? []).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No invoices yet.</div>
          ) : (
            ((data as any)?.invoices ?? []).map((inv: any) => (
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

      {/* Timeline */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
          Renewal & activity timeline
        </div>
        <div className="space-y-2">
          {((data as any)?.events ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">No events yet.</div>
          ) : (
            ((data as any)?.events ?? []).map((ev: any) => (
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
