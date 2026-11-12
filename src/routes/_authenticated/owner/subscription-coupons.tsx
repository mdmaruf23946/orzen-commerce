import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Mail } from "lucide-react";
import { PromoEmailDialog } from "@/components/owner/PromoEmailDialog";
import {
  listSubscriptionCoupons,
  upsertSubscriptionCoupon,
  deleteSubscriptionCoupon,
} from "@/lib/subscription-pay/pay.functions";
import { listPublicPlans } from "@/lib/payments/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/subscription-coupons")({
  head: () => ({ meta: [{ title: "Promo Codes — Winner Admin" }] }),
  component: CouponsPage,
});

const CYCLES = [
  { key: "monthly", label: "Monthly" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "yearly", label: "Yearly" },
] as const;

type Form = {
  id?: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: string;
  max_discount: string;
  min_amount: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  packages: string[];
  cycles: string[];
  plan_amounts: Record<string, string>;
  cycle_amounts: Record<string, string>;
  active: boolean;
};

const empty: Form = {
  code: "", description: "", type: "percent", value: "10", max_discount: "", min_amount: "",
  usage_limit: "", starts_at: "", expires_at: "", packages: [], cycles: [], plan_amounts: {}, cycle_amounts: {}, active: true,
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const toDate = (v?: string | null) => (v ? v.slice(0, 10) : "");

function CouponsPage() {
  const listFn = useServerFn(listSubscriptionCoupons);
  const saveFn = useServerFn(upsertSubscriptionCoupon);
  const delFn = useServerFn(deleteSubscriptionCoupon);
  const [mailCoupon, setMailCoupon] = useState<{ id: string; code: string } | null>(null);
  const plansFn = useServerFn(listPublicPlans);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "subCoupons"], queryFn: () => listFn() });
  const { data: plansRaw } = useQuery({ queryKey: ["owner", "couponPlans"], queryFn: () => plansFn() });
  const plans = ((plansRaw ?? []) as any[]).filter((p) => Number(p.price) > 0 && !p.is_trial);
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "Plan";
  const [f, setF] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function edit(c: any) {
    setF({
      id: c.id, code: c.code, description: c.description ?? "", type: c.type, value: String(c.value),
      max_discount: c.max_discount != null ? String(c.max_discount) : "",
      min_amount: c.min_amount ? String(c.min_amount) : "",
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      starts_at: toDate(c.starts_at), expires_at: toDate(c.expires_at),
      packages: c.applies_to_packages ?? [], cycles: c.applies_to_cycles ?? [],
      plan_amounts: Object.fromEntries(Object.entries(c.plan_amounts ?? {}).map(([k, v]) => [k, String(v)])),
      cycle_amounts: Object.fromEntries(Object.entries(c.cycle_amounts ?? {}).map(([k, v]) => [k, String(v)])),
      active: c.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function payload(x: Form) {
    const plan_amounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(x.plan_amounts)) if (v.trim() !== "" && Number(v) > 0) plan_amounts[k] = Number(v);
    const cycle_amounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(x.cycle_amounts)) if (v.trim() !== "" && Number(v) > 0) cycle_amounts[k] = Number(v);
    return {
      cycle_amounts,
      id: x.id, code: x.code.trim(), description: x.description.trim() || null, type: x.type, value: Number(x.value) || 0,
      max_discount: x.type === "percent" ? num(x.max_discount) : null, min_amount: num(x.min_amount) ?? 0,
      usage_limit: num(x.usage_limit), applies_to_packages: x.packages, applies_to_cycles: x.cycles as any,
      starts_at: x.starts_at ? new Date(x.starts_at + "T00:00:00").toISOString() : null,
      expires_at: x.expires_at ? new Date(x.expires_at + "T23:59:59").toISOString() : null,
      plan_amounts, active: x.active,
    };
  }

  async function save() {
    if (f.code.trim().length < 2) return toast.error("কোড কমপক্ষে ২ অক্ষরের দিন");
    if (f.type === "percent" && (Number(f.value) <= 0 || Number(f.value) > 100)) return toast.error("পার্সেন্ট ১–১০০ এর মধ্যে দিন");
    setSaving(true);
    try {
      await saveFn({ data: payload(f) });
      toast.success("প্রোমো কোড সেভ হয়েছে");
      setF(empty);
      qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] });
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  function describe(c: any) {
    const main = c.type === "percent" ? `${c.value}%${c.max_discount ? ` (সর্বোচ্চ ৳${c.max_discount})` : ""}` : `৳${c.value}`;
    const per = Object.entries(c.plan_amounts ?? {}).map(([k, v]) => `${planName(k)}: ৳${v}`);
    const cyc = Object.entries(c.cycle_amounts ?? {}).map(([k, v]) => `${CYCLES.find((x) => x.key === k)?.label ?? k}: ৳${v}`);
    return [main, per.join(", "), cyc.join(", ")].filter(Boolean).join(" · ");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Promo Codes</h1>
        <p className="text-sm text-muted-foreground">মার্চেন্টরা প্যাকেজ কেনার সময় এই কোড দিয়ে ছাড় পাবে। ছাড়ের হিসাব সার্ভারেই হয়।</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <h2 className="font-semibold">{f.id ? `Edit ${f.code}` : "New promo code"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="SAVE20" maxLength={40} /></div>
          <div className="space-y-1.5"><Label>Discount type</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as any })}>
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed amount (৳)</option>
            </select>
          </div>
          <div className="space-y-1.5"><Label>{f.type === "percent" ? "Percent off" : "Taka off"}</Label><Input type="number" min={0} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>
          {f.type === "percent" && (
            <div className="space-y-1.5"><Label>Max discount (৳, optional)</Label><Input type="number" min={0} value={f.max_discount} onChange={(e) => setF({ ...f, max_discount: e.target.value })} placeholder="No limit" /></div>
          )}
          <div className="space-y-1.5"><Label>Minimum plan price (৳)</Label><Input type="number" min={0} value={f.min_amount} onChange={(e) => setF({ ...f, min_amount: e.target.value })} placeholder="0" /></div>
          <div className="space-y-1.5"><Label>Total uses limit</Label><Input type="number" min={0} value={f.usage_limit} onChange={(e) => setF({ ...f, usage_limit: e.target.value })} placeholder="Unlimited" /></div>
          <div className="space-y-1.5"><Label>Starts</Label><Input type="date" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Expires</Label><Input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={200} /></div>
        </div>

        <div className="space-y-2">
          <Label>Works on which plans? <span className="font-normal text-muted-foreground">(কিছু না বাছলে সব প্ল্যানে)</span></Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => {
              const on = f.packages.includes(p.id);
              return (
                <div key={p.id} className={`rounded-xl border p-3 ${on ? "border-primary bg-primary/5" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={on} onChange={() => setF({ ...f, packages: toggle(f.packages, p.id) })} />
                    {p.name} <span className="font-normal text-muted-foreground">৳{Number(p.price)}/mo</span>
                  </label>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    এই প্ল্যানে মাসিক ছাড় ৳
                    <Input className="h-8 w-24" type="number" min={0} value={f.plan_amounts[p.id] ?? ""}
                      onChange={(e) => setF({ ...f, plan_amounts: { ...f.plan_amounts, [p.id]: e.target.value } })} placeholder="—" />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">টাকার ছাড় প্রতি মাস হিসেবে — ৩ মাসে ৩ গুণ, ৬ মাসে ৬ গুণ, বাৎসরিক প্ল্যানে ১২ গুণ কমবে।</p>
        </div>

        <div className="space-y-2">
          <Label>Billing period <span className="font-normal text-muted-foreground">(কিছু না বাছলে সব মেয়াদে)</span></Label>
          <div className="flex flex-wrap gap-3">
            {CYCLES.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.cycles.includes(c.key)} onChange={() => setF({ ...f, cycles: toggle(f.cycles, c.key) })} /> {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>মেয়াদ অনুযায়ী বাড়তি ছাড় <span className="font-normal text-muted-foreground">(ঐচ্ছিক — মোট কত টাকা কমবে)</span></Label>
          <div className="grid gap-2 sm:grid-cols-4">
            {CYCLES.map((c) => (
              <div key={c.key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{c.label} ৳</span>
                <Input type="number" min={0} value={f.cycle_amounts[c.key] ?? ""} placeholder="অটো (মাস × ছাড়)"
                  onChange={(e) => setF({ ...f, cycle_amounts: { ...f.cycle_amounts, [c.key]: e.target.value } })} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">কোনো মেয়াদে টাকা লিখলে সেই মেয়াদে মোট ঠিক ওই টাকাই কমবে। খালি রাখলে মাসিক ছাড় × মাস হিসেবে কমবে।</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> Active</label>
          <div className="ml-auto flex gap-2">
            {f.id && <Button variant="ghost" onClick={() => setF(empty)}>Cancel</Button>}
            <Button onClick={save} disabled={saving} className="gap-1"><Plus className="h-4 w-4" /> {f.id ? "Update" : "Create"}</Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">All promo codes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Code</th><th>Discount</th><th>Plans</th><th>Used</th><th>Expires</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((c: any) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td className="py-2">{describe(c)}</td>
                  <td className="py-2">{(c.applies_to_packages ?? []).length ? c.applies_to_packages.map(planName).join(", ") : "All"}</td>
                  <td className="py-2">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                  <td className="py-2">{c.expires_at ? toDate(c.expires_at) : "—"}</td>
                  <td className="py-2">
                    <Switch checked={c.active} onCheckedChange={async (v) => {
                      try {
                        await saveFn({ data: { id: c.id, code: c.code, type: c.type, value: Number(c.value), min_amount: Number(c.min_amount ?? 0),
                          applies_to_packages: c.applies_to_packages ?? [], applies_to_cycles: c.applies_to_cycles ?? [], usage_limit: c.usage_limit,
                          starts_at: c.starts_at, expires_at: c.expires_at, max_discount: c.max_discount, plan_amounts: c.plan_amounts ?? {}, cycle_amounts: c.cycle_amounts ?? {},
                          description: c.description, active: v } });
                        qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] });
                      } catch (e) { toast.error((e as Error).message); }
                    }} />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" aria-label="Send by email" title="ইমেইলে পাঠান" onClick={() => setMailCoupon({ id: c.id, code: c.code })}><Mail className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={async () => {
                      if (!confirm(`Delete ${c.code}?`)) return;
                      try { await delFn({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["owner", "subCoupons"] }); }
                      catch (e) { toast.error((e as Error).message); }
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No promo codes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PromoEmailDialog coupon={mailCoupon} onClose={() => setMailCoupon(null)} />
    </div>
  );
}
