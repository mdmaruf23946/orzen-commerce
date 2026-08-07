import { useMemo, useState } from "react";
import { Pencil, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EXPENSE_CATEGORIES, categoryLabel, money } from "@/lib/finance-ui";
import type { ExpenseRow } from "./ExpenseForm";

export function ExpenseHistory({
  rows,
  onEdit,
  onDelete,
}: {
  rows: ExpenseRow[];
  onEdit: (r: ExpenseRow) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [minAmt, setMinAmt] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = Number(minAmt) || 0;
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (min && Number(r.amount) < min) return false;
      if (term && !`${r.note ?? ""} ${categoryLabel(r.category)} ${r.spent_on}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, q, cat, minAmt]);

  const total = filtered.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses…" className="h-10 pl-9" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm sm:w-48">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          value={minAmt}
          onChange={(e) => setMinAmt(e.target.value)}
          placeholder="Min ৳"
          className="h-10 sm:w-28"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">No expenses found.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="divide-y sm:hidden">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{categoryLabel(e.category)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{e.spent_on}</span>
                  </div>
                  {e.note && <div className="mt-0.5 truncate text-xs text-muted-foreground">{e.note}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{money(e.amount)}</div>
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => onEdit(e)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => onDelete(e.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Note</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-3 text-xs">{e.spent_on}</td>
                    <td className="p-3 text-xs">{categoryLabel(e.category)}</td>
                    <td className="p-3 text-right tabular-nums">{money(e.amount)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{e.note ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onEdit(e)} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => onDelete(e.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
            <span>{filtered.length} record(s)</span>
            <span className="font-semibold text-foreground">Total {money(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
