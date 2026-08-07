import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, iso, type ExpenseCategory } from "@/lib/finance-ui";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number | string;
  note: string | null;
  spent_on: string;
};

export function ExpenseForm({
  editing,
  onCancelEdit,
  onSubmit,
}: {
  editing: ExpenseRow | null;
  onCancelEdit: () => void;
  onSubmit: (v: { id?: string; category: ExpenseCategory; amount: number; note?: string; spent_on: string }) => Promise<void>;
}) {
  const [cat, setCat] = useState<ExpenseCategory>("ads");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const known = EXPENSE_CATEGORIES.find((c) => c.id === editing.category);
    setCat((known?.id ?? "other") as ExpenseCategory);
    setAmount(String(editing.amount));
    setNote(editing.note ?? "");
    setDate(editing.spent_on);
  }, [editing]);

  function reset() {
    setCat("ads");
    setAmount("");
    setNote("");
    setDate(iso(new Date()));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      await onSubmit({ ...(editing ? { id: editing.id } : {}), category: cat, amount: value, note, spent_on: date });
      toast.success(editing ? "Expense updated" : "Expense recorded");
      reset();
      onCancelEdit();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{editing ? "Edit expense" : "Add expense"}</h2>
        {editing && (
          <button type="button" onClick={() => { onCancelEdit(); reset(); }} className="text-xs text-muted-foreground hover:underline">
            Cancel
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as ExpenseCategory)}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Amount (৳)</Label>
          <Input type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10" />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : editing ? "Save changes" : "Add expense"}
      </Button>
    </form>
  );
}
