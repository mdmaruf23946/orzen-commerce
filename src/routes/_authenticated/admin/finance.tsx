import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { listExpenses, addExpense, deleteExpense, financeSummary } from "@/lib/business.functions";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { RangeFilter } from "@/components/admin/finance/RangeFilter";
import { SummaryCards, ProfitLoss, type FinanceSummary } from "@/components/admin/finance/SummaryCards";
import { FinanceChart } from "@/components/admin/finance/FinanceChart";
import { ExpenseForm, type ExpenseRow } from "@/components/admin/finance/ExpenseForm";
import { ExpenseHistory } from "@/components/admin/finance/ExpenseHistory";
import { categoryLabel, downloadCsv, iso, money, rangeFor, type RangeKey } from "@/lib/finance-ui";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  head: () => ({
    meta: [
      { title: "Business Finance | ORZEN Store Admin" },
      { name: "description", content: "Track store sales, expenses, profit and COD receivable with date-range reporting." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const list = useServerFn(listExpenses);
  const add = useServerFn(addExpense);
  const del = useServerFn(deleteExpense);
  const sumFn = useServerFn(financeSummary);
  const qc = useQueryClient();

  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const [custom, setCustom] = useState({ from: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: iso(new Date()) });
  const range = useMemo(() => rangeFor(rangeKey, custom), [rangeKey, custom]);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const { data: sum } = useQuery({
    queryKey: ["finance-summary", range.from, range.to],
    queryFn: () => sumFn({ data: range }),
  });
  const { data: items } = useQuery({
    queryKey: ["expenses", range.from, range.to],
    queryFn: () => list({ data: range }),
  });

  const rows = (items ?? []) as ExpenseRow[];

  function refresh() {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    await del({ data: { id } });
    if (editing?.id === id) setEditing(null);
    refresh();
  }

  function exportCsv() {
    if (!sum) return;
    downloadCsv(`finance-${range.from}_${range.to}.csv`, [
      ["ORZEN Finance Report", `${range.from} to ${range.to}`],
      [],
      ["Metric", "Amount (BDT)"],
      ["Sales", sum.rangeSales],
      ["Product Cost", sum.rangeCogs],
      ["Other Expenses", sum.rangeExpense],
      ["Net Profit", sum.rangeProfit],
      ["COD Receivable", sum.codReceivable],
      [],
      ["Date", "Sales", "Product Cost", "Expenses", "Profit"],
      ...sum.series.map((s) => [s.d, s.sales, s.cogs, s.expense, s.sales - s.cogs - s.expense]),
      [],
      ["Expense date", "Category", "Amount", "Note"],
      ...rows.map((r) => [r.spent_on, categoryLabel(r.category), Number(r.amount), r.note ?? ""]),
    ]);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <AdminPageHeader
        title="Business Finance"
        description="Sales, expenses, profit and COD receivable from your real store data."
        action={
          <div className="flex gap-2 print:hidden">
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Download className="h-4 w-4" /> CSV / Excel
            </button>
            <button onClick={exportPdf} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">PDF</button>
          </div>
        }
      />

      <div className="print:hidden">
        <RangeFilter value={rangeKey} onChange={setRangeKey} custom={custom} onCustomChange={setCustom} />
      </div>

      {!sum ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <SummaryCards s={sum as FinanceSummary} />
          <div className="grid gap-3 lg:grid-cols-2">
            <ProfitLoss s={sum as FinanceSummary} />
            <FinanceChart series={sum.series} />
          </div>

          {Object.keys(sum.byCategory).length > 0 && (
            <div className="rounded-xl border bg-card p-3 sm:p-4">
              <h2 className="text-sm font-semibold">Expenses by category</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(sum.byCategory).map(([c, v]) => (
                  <div key={c} className="rounded-lg border bg-muted/30 p-2.5">
                    <div className="truncate text-[11px] text-muted-foreground">{categoryLabel(c)}</div>
                    <div className="text-sm font-semibold tabular-nums">{money(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="print:hidden">
        <ExpenseForm
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          onSubmit={async (v) => {
            await add({ data: v });
            refresh();
          }}
        />
      </div>

      <ExpenseHistory rows={rows} onEdit={setEditing} onDelete={remove} />
    </div>
  );
}
