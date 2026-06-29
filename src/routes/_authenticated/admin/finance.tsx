import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { listExpenses, addExpense, deleteExpense, financeSummary } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  { id: "fb_ads", label: "Facebook Ads" },
  { id: "courier", label: "Courier Cost" },
  { id: "packaging", label: "Packaging" },
  { id: "salary", label: "Staff Salary" },
  { id: "misc", label: "Miscellaneous" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/finance")({
  component: FinancePage,
});

function FinancePage() {
  const list = useServerFn(listExpenses);
  const add = useServerFn(addExpense);
  const del = useServerFn(deleteExpense);
  const sumFn = useServerFn(financeSummary);
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["expenses"], queryFn: () => list({ data: {} }) });
  const { data: sum } = useQuery({ queryKey: ["finance-summary"], queryFn: () => sumFn() });
  const [cat, setCat] = useState<typeof CATEGORIES[number]["id"]>("fb_ads");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await add({ data: { category: cat, amount: Number(amount), note, spent_on: date } });
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success("Expense recorded");
    } catch (err) { toast.error((err as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  }

  const cards = [
    { label: "Today's Sales", v: sum?.todaySales ?? 0, c: "text-foreground" },
    { label: "Today's Expenses", v: sum?.todayExpense ?? 0, c: "text-destructive" },
    { label: "Today's Profit", v: sum?.todayProfit ?? 0, c: (sum?.todayProfit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Monthly Profit", v: sum?.monthProfit ?? 0, c: (sum?.monthProfit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive" },
    { label: "Net Profit", v: sum?.netProfit ?? 0, c: (sum?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Business Finance</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-xl font-bold ${c.c}`}>৳{Number(c.v).toFixed(0)}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Add expense</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select value={cat} onChange={(e) => setCat(e.target.value as any)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (৳)</Label>
            <Input type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button type="submit">Record expense</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Note</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((e: any) => (
              <tr key={e.id} className="border-t">
                <td className="p-3 text-xs">{e.spent_on}</td>
                <td className="p-3 text-xs">{CATEGORIES.find((c) => c.id === e.category)?.label ?? e.category}</td>
                <td className="p-3 text-right">৳{Number(e.amount).toFixed(0)}</td>
                <td className="p-3 text-xs text-muted-foreground">{e.note ?? "—"}</td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(e.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items ?? []).length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No expenses logged.</div>}
      </div>
    </div>
  );
}
