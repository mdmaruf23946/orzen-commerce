import { FeatureGate } from "@/components/admin/FeatureGate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getDuplicateSettings,
  updateDuplicateSettings,
  listDuplicateBlocks,
  approveBlockedOrder,
  dismissBlockedOrder,
  listWhitelist,
  addWhitelist,
  removeWhitelist,
  listExcludedProducts,
  addExcludedProduct,
  removeExcludedProduct,
  listStoreProductsForPicker,
} from "@/lib/duplicate-protection.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/duplicate-protection")({
  head: () => ({ meta: [
      { title: "Duplicate Order Protection — ORZEN Merchant Panel" },
      { name: "description", content: "Block repeated or fraudulent duplicate orders automatically." },
      { property: "og:title", content: "Duplicate Order Protection — ORZEN Merchant Panel" },
      { property: "og:description", content: "Block repeated or fraudulent duplicate orders automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ] }),
  component: () => (
    <FeatureGate feature="duplicate_protection">
      <Page />
    </FeatureGate>
  ),
});

function Page() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Duplicate Order Protection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prevent duplicate orders based on configurable rules. Works independently per store.
        </p>
      </div>
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="blocked">Blocked</TabsTrigger>
          <TabsTrigger value="lists">Whitelist &amp; Exclude</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
        <TabsContent value="blocked" className="mt-4"><BlockedTab /></TabsContent>
        <TabsContent value="lists" className="mt-4"><ListsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsTab() {
  const get = useServerFn(getDuplicateSettings);
  const save = useServerFn(updateDuplicateSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dp-settings"], queryFn: () => get() });
  const [form, setForm] = useState<any>(null);
  const s = form ?? data;
  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;
  function set<K extends string>(k: K, v: any) { setForm({ ...s, [k]: v }); }
  async function onSave() {
    try {
      await save({ data: {
        enabled: !!s.enabled, mode: s.mode, period_days: Number(s.period_days),
        rule_phone: !!s.rule_phone, rule_product: !!s.rule_product,
        rule_fingerprint: !!s.rule_fingerprint, rule_device: !!s.rule_device,
        rule_customer: !!s.rule_customer, match_logic: s.match_logic,
        rule_psid: !!s.rule_psid,
        messenger_enabled: s.messenger_enabled !== false,
        messenger_custom_reply: s.messenger_custom_reply ?? null,
      } as any });
      qc.invalidateQueries({ queryKey: ["dp-settings"] });
      toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Enable duplicate protection</div>
          <div className="text-xs text-muted-foreground">Master switch for this store.</div>
        </div>
        <Switch checked={!!s.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select value={s.mode} onValueChange={(v) => set("mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="block">Block automatically</SelectItem>
              <SelectItem value="warn">Allow with warning</SelectItem>
              <SelectItem value="off">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Protection period</Label>
          <Select value={String(s.period_days)} onValueChange={(v) => set("period_days", Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,3,7,15,30].map((n) => <SelectItem key={n} value={String(n)}>{n} days</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Rules</Label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ["rule_phone", "Same phone number"],
            ["rule_product", "Same product"],
            ["rule_customer", "Same customer account"],
            ["rule_fingerprint", "Same browser fingerprint"],
            ["rule_device", "Same device"],
            ["rule_psid", "Same Messenger PSID"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>{label}</span>
              <Switch checked={!!s[k as string]} onCheckedChange={(v) => set(k as string, v)} />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Match logic</Label>
        <Select value={s.match_logic} onValueChange={(v) => set("match_logic", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any rule matches (recommended)</SelectItem>
            <SelectItem value="all">All enabled rules must match</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Messenger duplicate protection</div>
            <div className="text-xs text-muted-foreground">
              Apply the rules above to orders placed through the Messenger AI agent.
            </div>
          </div>
          <Switch
            checked={s.messenger_enabled !== false}
            onCheckedChange={(v) => set("messenger_enabled", v)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Custom AI reply (optional)</Label>
          <textarea
            className="w-full min-h-[96px] rounded-md border bg-background p-2 text-sm"
            placeholder="Leave blank to use the default polite reply with invoice number and status."
            value={s.messenger_custom_reply ?? ""}
            onChange={(e) => set("messenger_custom_reply", e.target.value)}
          />
        </div>
      </div>

      <Button onClick={onSave} className="w-full sm:w-auto">Save changes</Button>
    </div>
  );
}

function BlockedTab() {
  const list = useServerFn(listDuplicateBlocks);
  const approve = useServerFn(approveBlockedOrder);
  const dismiss = useServerFn(dismissBlockedOrder);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"blocked" | "approved" | "dismissed" | "warned" | "all">("blocked");
  const { data } = useQuery({
    queryKey: ["dp-blocks", status],
    queryFn: () => list({ data: { status } }),
  });
  async function onApprove(id: string) {
    try { await approve({ data: { blockId: id } }); toast.success("Order created"); qc.invalidateQueries({ queryKey: ["dp-blocks"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function onDismiss(id: string) {
    try { await dismiss({ data: { blockId: id } }); qc.invalidateQueries({ queryKey: ["dp-blocks"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["blocked","warned","approved","dismissed","all"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {(data ?? []).length === 0 && (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">No records.</div>
        )}
        {(data ?? []).map((b: any) => (
          <div key={b.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{b.payload?.customerName ?? "—"} · {b.phone ?? "no phone"}</div>
              <Badge variant={b.status === "blocked" ? "destructive" : "secondary"}>{b.status}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(b.created_at).toLocaleString()} · matched: {(b.matched_rules ?? []).join(", ") || "—"}
            </div>
            {b.payload?.address && (
              <div className="mt-2 text-xs">Address: {b.payload.address}</div>
            )}
            {b.status === "blocked" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onApprove(b.id)}>Approve &amp; create order</Button>
                <Button size="sm" variant="outline" onClick={() => onDismiss(b.id)}>Dismiss</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ListsTab() {
  const wl = useServerFn(listWhitelist);
  const addWl = useServerFn(addWhitelist);
  const rmWl = useServerFn(removeWhitelist);
  const excl = useServerFn(listExcludedProducts);
  const addEx = useServerFn(addExcludedProduct);
  const rmEx = useServerFn(removeExcludedProduct);
  const prods = useServerFn(listStoreProductsForPicker);
  const qc = useQueryClient();
  const { data: wlData } = useQuery({ queryKey: ["dp-wl"], queryFn: () => wl() });
  const { data: exData } = useQuery({ queryKey: ["dp-ex"], queryFn: () => excl() });
  const { data: prodData } = useQuery({ queryKey: ["dp-products"], queryFn: () => prods() });
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pid, setPid] = useState("");

  async function addPhone() {
    if (!phone.trim()) return;
    try { await addWl({ data: { phone: phone.trim(), note: note || undefined } });
      setPhone(""); setNote(""); qc.invalidateQueries({ queryKey: ["dp-wl"] }); toast.success("Whitelisted");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function delWl(id: string) {
    await rmWl({ data: { id } }); qc.invalidateQueries({ queryKey: ["dp-wl"] });
  }
  async function addProd() {
    if (!pid) return;
    try { await addEx({ data: { productId: pid } });
      setPid(""); qc.invalidateQueries({ queryKey: ["dp-ex"] }); toast.success("Excluded");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function delEx(id: string) {
    await rmEx({ data: { id } }); qc.invalidateQueries({ queryKey: ["dp-ex"] });
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Whitelisted customers</h2>
        <p className="mt-1 text-xs text-muted-foreground">These phones bypass the duplicate check.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="sm:col-span-1" />
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="sm:col-span-1" />
          <Button onClick={addPhone}>Add</Button>
        </div>
        <ul className="mt-3 divide-y">
          {(wlData ?? []).map((w: any) => (
            <li key={w.id} className="flex items-center justify-between py-2 text-sm">
              <span>{w.phone ?? w.customer_id} {w.note && <span className="text-muted-foreground">— {w.note}</span>}</span>
              <Button size="sm" variant="ghost" onClick={() => delWl(w.id)}>Remove</Button>
            </li>
          ))}
          {(wlData ?? []).length === 0 && <li className="py-2 text-xs text-muted-foreground">None yet.</li>}
        </ul>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Excluded products</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ordering these does not trigger duplicate protection.</p>
        <div className="mt-3 flex gap-2">
          <select
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            className="h-10 flex-1 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">— pick product —</option>
            {(prodData ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={addProd}>Add</Button>
        </div>
        <ul className="mt-3 divide-y">
          {(exData ?? []).map((e: any) => (
            <li key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span>{e.product_name || e.product_id}</span>
              <Button size="sm" variant="ghost" onClick={() => delEx(e.id)}>Remove</Button>
            </li>
          ))}
          {(exData ?? []).length === 0 && <li className="py-2 text-xs text-muted-foreground">None yet.</li>}
        </ul>
      </div>
    </div>
  );
}
