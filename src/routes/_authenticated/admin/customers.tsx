import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listStoreCustomers,
  exportStoreCustomers,
  setCustomerBlocked,
} from "@/lib/customers-admin.functions";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { AdminToolbar } from "@/components/admin/page/AdminToolbar";
import { CustomerProfileSheet } from "@/components/admin/customers/CustomerProfileSheet";
import { writeCsv, writeXlsx } from "@/components/admin/import-export/io";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { taka } from "@/lib/order-display";
import {
  Users, UserPlus, Repeat, Crown, Wallet, Receipt, MoreHorizontal, Download,
  FileSpreadsheet, Printer, Phone, Mail, MessageSquare, Ban, CheckCircle2, ChevronLeft, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

type Filter = "all" | "new" | "returning" | "vip" | "blocked" | "pending" | "returns" | "exchanges";
type Sort = "newest" | "spend" | "orders" | "last" | "alpha";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "returning", label: "Returning" },
  { key: "vip", label: "VIP" },
  { key: "blocked", label: "Blocked" },
  { key: "pending", label: "Pending orders" },
  { key: "returns", label: "Has returns" },
  { key: "exchanges", label: "Has exchanges" },
];

const STATUS_TONE: Record<string, string> = {
  new: "bg-sky-100 text-sky-700",
  returning: "bg-blue-100 text-blue-700",
  vip: "bg-amber-100 text-amber-700",
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-rose-100 text-rose-700",
};

const PAGE_SIZE = 25;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function CustomersPage() {
  const list = useServerFn(listStoreCustomers);
  const exportFn = useServerFn(exportStoreCustomers);
  const blockFn = useServerFn(setCustomerBlocked);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("last");
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<string>("overview");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "customers", search, filter, sort, page],
    queryFn: () => list({ data: { search, filter, sort, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const s = data?.summary;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const cards = useMemo(
    () => [
      { label: "Total customers", value: (s?.total ?? 0).toLocaleString(), icon: Users },
      { label: "New today", value: (s?.newToday ?? 0).toLocaleString(), sub: `${s?.newMonth ?? 0} this month`, icon: UserPlus },
      { label: "Returning", value: (s?.returning ?? 0).toLocaleString(), icon: Repeat },
      { label: "VIP", value: (s?.vip ?? 0).toLocaleString(), icon: Crown },
      { label: "Customer revenue", value: taka(s?.revenue ?? 0), icon: Wallet },
      { label: "Avg order value", value: taka(s?.aov ?? 0), icon: Receipt },
    ],
    [s],
  );

  async function runExport(kind: "csv" | "xlsx" | "print") {
    try {
      const res = await exportFn({ data: { search, filter, sort } });
      if (!res.rows.length) return toast.error("Nothing to export");
      const name = `customers-${new Date().toISOString().slice(0, 10)}`;
      if (kind === "csv") writeCsv(res.header, res.rows, name);
      else if (kind === "xlsx") writeXlsx(res.header, res.rows, name);
      else printReport(res.header, res.rows);
      if (kind !== "print") toast.success(`Exported ${res.rows.length} customers`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleBlock(accountId: string, currentlyActive: boolean) {
    try {
      await blockFn({ data: { accountId, blocked: currentlyActive } });
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      qc.invalidateQueries({ queryKey: ["admin", "customer-profile"] });
      toast.success(currentlyActive ? "Customer blocked" : "Customer unblocked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function open(key: string, tab = "overview") {
    setOpenTab(tab);
    setOpenKey(key);
  }

  const exportMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => runExport("csv")}><Download className="mr-2 h-4 w-4" />Export CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runExport("xlsx")}><FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runExport("print")}><Printer className="mr-2 h-4 w-4" />Print report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Customers"
        description="Every buyer merged by phone number, with lifetime value, orders and history."
        action={exportMenu}
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="min-w-[150px] flex-1 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
              <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{isLoading ? "—" : c.value}</div>
            {c.sub && <div className="text-[10px] text-muted-foreground">{c.sub}</div>}
          </div>
        ))}
      </div>

      <AdminToolbar
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search name, phone, email or order ID"
        action={<div className="sm:hidden">{exportMenu}</div>}
        trailing={
          <Select value={sort} onValueChange={(v: Sort) => setSort(v)}>
            <SelectTrigger className="h-10 sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last">Last order</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="spend">Highest spending</SelectItem>
              <SelectItem value="orders">Most orders</SelectItem>
              <SelectItem value="alpha">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">No customers match this view.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((c) => (
              <div key={c.key} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(c.key)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                      <span>{c.orders} orders</span>
                      <span className="font-semibold">{taka(c.spend)}</span>
                      <span className="text-muted-foreground">{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : "—"}</span>
                    </div>
                  </button>
                  <RowMenu c={c} open={open} toggleBlock={toggleBlock} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Spend</th>
                  <th className="p-3">Last order</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.key} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <button className="flex items-center gap-3 text-left" onClick={() => open(c.key)}>
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          {c.tags.length > 0 && (
                            <div className="truncate text-[10px] text-muted-foreground">{c.tags.join(" · ")}</div>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      <div>{c.phone || "—"}</div>
                      {c.email && <div className="truncate">{c.email}</div>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.orders}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{taka(c.spend)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : "—"}</td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-right"><RowMenu c={c} open={open} toggleBlock={toggleBlock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total.toLocaleString()} customers{isFetching ? " · updating…" : ""}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <CustomerProfileSheet
        customerKey={openKey}
        initialTab={openTab}
        onOpenChange={(v) => !v && setOpenKey(null)}
        onToggleBlock={(id, active) => toggleBlock(id, active)}
      />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials(name)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={`h-5 border-0 text-[10px] capitalize ${STATUS_TONE[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function RowMenu({
  c,
  open,
  toggleBlock,
}: {
  c: any;
  open: (key: string, tab?: string) => void;
  toggleBlock: (id: string, active: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => open(c.key)}>View profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(c.key, "orders")}>View orders</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(c.key, "returns")}>Return & exchange history</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(c.key, "addresses")}>Saved addresses</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(c.key, "timeline")}>Timeline</DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(c.key, "notes")}>Internal notes</DropdownMenuItem>
        <DropdownMenuSeparator />
        {c.phone && (
          <>
            <DropdownMenuItem asChild><a href={`sms:${c.phone}`}><MessageSquare className="mr-2 h-4 w-4" />Send SMS</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={`tel:${c.phone}`}><Phone className="mr-2 h-4 w-4" />Call customer</a></DropdownMenuItem>
          </>
        )}
        {c.email && (
          <DropdownMenuItem asChild><a href={`mailto:${c.email}`}><Mail className="mr-2 h-4 w-4" />Send email</a></DropdownMenuItem>
        )}
        {c.accountId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toggleBlock(c.accountId, !c.blocked)}>
              {c.blocked ? <><CheckCircle2 className="mr-2 h-4 w-4" />Unblock</> : <><Ban className="mr-2 h-4 w-4" />Block</>}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function printReport(header: string[], rows: Record<string, any>[]) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
  w.document.write(`<!doctype html><html><head><title>Customer report</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f5f5f5;text-transform:capitalize}</style>
  </head><body><h1>Customer report — ${new Date().toLocaleDateString()}</h1>
  <table><thead><tr>${header.map((h) => `<th>${esc(h.replace(/_/g, " "))}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${header.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`).join("")}</tbody></table>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
