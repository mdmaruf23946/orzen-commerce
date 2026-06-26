import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listMyCategories, upsertCategory, deleteCategory } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const list = useServerFn(listMyCategories);
  const save = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const qc = useQueryClient();
  const { data: categories } = useQuery({ queryKey: ["admin", "categories"], queryFn: () => list() });
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await save({ data: { id: editingId ?? undefined, name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      setName("");
      setEditingId(null);
      toast.success("Saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Products will be uncategorised.")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    toast.success("Deleted");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <form onSubmit={submit} className="flex gap-2 rounded-xl border bg-card p-4">
        <Input
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy}>
          {editingId ? <Pencil className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
          {editingId ? "Update" : "Add"}
        </Button>
        {editingId && (
          <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setName(""); }}>
            Cancel
          </Button>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        {(categories ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No categories yet.</div>
        ) : (
          <ul className="divide-y">
            {(categories ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <p className="flex-1 text-sm font-medium">{c.name}</p>
                <button
                  onClick={() => { setEditingId(c.id); setName(c.name); }}
                  className="rounded p-2 hover:bg-muted"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded p-2 hover:bg-destructive/10 text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
