import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  listSubscriptionCoupons,
  upsertSubscriptionCoupon,
  deleteSubscriptionCoupon,
} from "@/lib/subscription-pay/pay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/subscription-coupons")({
  component: CouponsPage,
});

function CouponsPage() {
  const listFn = useServerFn(listSubscriptionCoupons);
  const saveFn = useServerFn(upsertSubscriptionCoupon);
  const delFn = useServerFn(deleteSubscriptionCoupon);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "subCoupons"], queryFn: () => listFn() });
  const [form, setForm] = useState({ code: "", type: "percent" as "percent" | "fixed", value: 10, active: true });

  async function create() {
    try {
      await saveFn({ data: {
        code: form.code, type: form.type, value: Number(form.value),
        min_amount: 0, applies_to_packages: [], applies_to_cycles: [],
        usage_limit: null, starts_at: null, expires_at: null, active: form.active,
      } });
      toast.success("Coupon saved");
      setForm({ code: "", type: "percent", value: 10, active: true });
      qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Subscription Coupons</h1>
        <p className="text-sm text-muted-foreground">Promo codes for ORZEN plan checkout (separate from store coupons).</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">New coupon</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed (৳)</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label>Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={create} className="w-full gap-1"><Plus className="h-4 w-4" /> Add</Button></div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">All coupons</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Code</th><th>Discount</th><th>Used</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td>{c.type === "percent" ? `${c.value}%` : `৳${c.value}`}</td>
                  <td>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                  <td>
                    <Switch checked={c.active} onCheckedChange={async (v) => {
                      try { await saveFn({ data: { id: c.id, code: c.code, type: c.type, value: c.value, min_amount: c.min_amount, applies_to_packages: c.applies_to_packages, applies_to_cycles: c.applies_to_cycles, usage_limit: c.usage_limit, active: v } });
                        qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] }); }
                      catch (e) { toast.error((e as Error).message); }
                    }} />
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm(`Delete ${c.code}?`)) return;
                      try { await delFn({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] }); }
                      catch (e) { toast.error((e as Error).message); }
                    }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
