import { FeatureGate } from "@/components/admin/FeatureGate";
import { csvCell } from "@/lib/csv-safe";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminListCustomerAccounts,
  adminGetCustomerAccount,
  adminSetCustomerActive,
} from "@/lib/admin.functions";
import { getCustomerNote, upsertCustomerNote } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, User, Download, Phone, Mail, MessageCircle, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers-accounts")({
  head: () => ({
    meta: [
      { title: "Customer Accounts — ORZEN Merchant Panel" },
      { name: "description", content: "Manage registered storefront customer accounts." },
      { property: "og:title", content: "Customer Accounts — ORZEN Merchant Panel" },
      { property: "og:description", content: "Manage registered storefront customer accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="customer_accounts">
      <CustomerAccountsPage />
    </FeatureGate>
  ),
});

const taka = (n: number) => `৳${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function tierOf(c: any, vipThreshold: number) {
  if (c.total_spent >= vipThreshold && vipThreshold > 0) return { label: "VIP", cls: "bg-amber-100 text-amber-700 dark:text-amber-300" };
  if (c.order_count >= 2) return { label: "Repeat", cls: "bg-indigo-100 text-indigo-700 dark:text-indigo-300" };
  return { label: "New", cls: "bg-muted text-muted-foreground" };
}

function CustomerAccountsPage() {
  const list = useServerFn(adminListCustomerAccounts);
  const setActive = useServerFn(adminSetCustomerActive);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [sort, setSort] = useState<"newest" | "orders" | "spend">("newest");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customer-accounts", search, status, sort],
    queryFn: () => list({ data: { search: search || undefined, status, sort } }),
  });

  const rows = (data ?? []) as any[];

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return {
      total: rows.length,
      active: rows.filter((r) => r.is_active).length,
      newThisMonth: rows.filter((r) => r.created_at >= monthStart).length,
      buyers: rows.filter((r) => r.order_count > 0).length,
    };
  }, [rows]);

  const vipThreshold = useMemo(() => {
    const spends = rows.map((r) => Number(r.total_spent || 0)).filter((n) => n > 0).sort((a, b) => b - a);
    if (spends.length < 4) return Infinity;
    return spends[Math.floor(spends.length * 0.2)] ?? Infinity;
  }, [rows]);

  async function toggleActive(id: string, active: boolean) {
    try {
      await setActive({ data: { customerId: id, active } });
      qc.invalidateQueries({ queryKey: ["admin", "customer-accounts"] });
      toast.success(active ? "Account activated" : "Account deactivated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function exportCsv() {
    const head = ["Customer code", "Name", "Email", "Phone", "Orders", "Total spent", "Last order", "Status", "Joined"];
    const lines = rows.map((c) =>
      [
        (c as any).customer_code ?? "",
        c.full_name ?? "",
        c.email ?? "",
        c.phone ?? "",
        c.order_count,
        Math.round(Number(c.total_spent || 0)),
        c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "",
        c.is_active ? "Active" : "Disabled",
        new Date(c.created_at).toLocaleDateString(),
      ]
        .map((v) => csvCell(v))
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Customer Accounts</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="pl-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Accounts" value={summary.total} />
        <Stat label="Active" value={summary.active} />
        <Stat label="New this month" value={summary.newThisMonth} />
        <Stat label="With orders" value={summary.buyers} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "disabled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${status === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="newest">Newest</option>
          <option value="orders">Most orders</option>
          <option value="spend">Highest spend</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No customer accounts yet.
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="divide-y sm:hidden">
              {rows.map((c: any) => {
                const t = tierOf(c, vipThreshold);
                return (
                  <li key={c.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{c.full_name}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${t.cls}`}>{t.label}</span>
                        </div>
                        {(c as any).customer_code && (
                          <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {(c as any).customer_code}
                          </div>
                        )}
                        <div className="truncate text-xs text-muted-foreground">
                          {c.email || c.phone}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.order_count} orders · {taka(c.total_spent)} · {c.is_active ? "Active" : "Disabled"}
                        </div>
                        {c.last_order_at && (
                          <div className="text-[11px] text-muted-foreground">
                            Last order {new Date(c.last_order_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>View</Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, !c.is_active)}>
                        {c.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Spent</th>
                  <th className="p-3">Last order</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c: any) => {
                  const t = tierOf(c, vipThreshold);
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-2">
                          {c.full_name}
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${t.cls}`}>{t.label}</span>
                        </div>
                        {c.customer_code && (
                          <div className="font-mono text-[11px] font-normal text-muted-foreground">{c.customer_code}</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div>{c.email}</div>
                        <div className="text-xs">{c.phone}</div>
                      </td>
                      <td className="p-3 text-right">{c.order_count}</td>
                      <td className="p-3 text-right">{taka(c.total_spent)}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${c.is_active ? "bg-emerald-100 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                          {c.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>View</Button>
                          <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, !c.is_active)}>
                            {c.is_active ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {selected && (
        <CustomerDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function initials(name?: string | null) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function CustomerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(adminGetCustomerAccount);
  const { data } = useQuery({
    queryKey: ["admin", "customer-account", id],
    queryFn: () => get({ data: { customerId: id } }),
  });
  const phone = (data as any)?.phone as string | undefined;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-sm font-semibold">
              {initials((data as any)?.full_name)}
            </span>
            <span className="flex-1 truncate">{data?.full_name ?? "Customer"}</span>
            {data && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${data.is_active ? "bg-emerald-100 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                {data.is_active ? "Active" : "Disabled"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {data.phone && (
                <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted">
                  <Phone className="h-3 w-3" /> Call
                </a>
              )}
              {data.phone && (
                <a
                  href={`https://wa.me/${String(data.phone).replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              )}
              {data.email && (
                <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted">
                  <Mail className="h-3 w-3" /> Email
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-4">
              <Mini label="Orders" value={String((data as any).stats?.order_count ?? 0)} />
              <Mini label="Total spent" value={taka((data as any).stats?.total_spent ?? 0)} />
              <Mini label="Avg order" value={taka((data as any).stats?.avg_order_value ?? 0)} />
              <Mini
                label="Last order"
                value={(data as any).stats?.last_order_at ? new Date((data as any).stats.last_order_at).toLocaleDateString() : "—"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              <Mini label="Email" value={data.email ?? "—"} />
              <Mini label="Phone" value={data.phone ?? "—"} />
              <Mini label="Joined" value={new Date(data.created_at).toLocaleDateString()} />
              <Mini
                label="Last login"
                value={data.last_login_at ? new Date(data.last_login_at).toLocaleString() : "Never"}
              />
            </div>

            {phone && <NotesBlock phone={phone} />}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent orders</h3>
              {data.orders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.orders.map((o: any) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                      <a
                        href={`/admin/invoice/${o.id}`}
                        className="min-w-0 flex-1 truncate font-medium hover:underline"
                      >
                        {o.invoice_no ?? o.id.slice(0, 8)}
                      </a>
                      <span className="text-muted-foreground">{o.status}</span>
                      <span className={`rounded-full px-1.5 py-0.5 ${o.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:text-amber-300"}`}>
                        {o.payment_status}
                      </span>
                      <span>
                        {taka(
                          Number(o.subtotal ?? 0) + Number(o.delivery_amount ?? 0) - Number(o.discount_amount ?? 0),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Saved addresses</h3>
              {data.addresses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved addresses.</p>
              ) : (
                <ul className="space-y-2">
                  {data.addresses.map((a: any) => (
                    <li key={a.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{a.label ?? a.name} {a.is_default && <span className="ml-1 text-muted-foreground">(default)</span>}</div>
                        <div className="text-muted-foreground">{a.address}{a.area ? `, ${a.area}` : ""}</div>
                        <div className="text-muted-foreground">{a.phone}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${a.name ?? ""}\n${a.phone ?? ""}\n${a.address}${a.area ? `, ${a.area}` : ""}`.trim(),
                          );
                          toast.success("Address copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}

function NotesBlock({ phone }: { phone: string }) {
  const get = useServerFn(getCustomerNote);
  const save = useServerFn(upsertCustomerNote);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "customer-note", phone],
    queryFn: () => get({ data: { phone } }),
  });
  const [note, setNote] = useState<string | null>(null);
  const value = note ?? (data as any)?.note ?? "";
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { phone, tags: ((data as any)?.tags ?? []) as string[], note: value } });
      qc.invalidateQueries({ queryKey: ["admin", "customer-note", phone] });
      toast.success("Note saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Internal note (not visible to customer)
      </h3>
      <Textarea
        value={value}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="e.g. prefers evening delivery, repeat buyer…"
      />
      <Button size="sm" className="mt-2" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Save note"}
      </Button>
    </div>
  );
}
