import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listMyCustomers } from "@/lib/admin.functions";
import { getCustomerNote, upsertCustomerNote } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

const TAG_PRESETS = ["Trusted", "VIP", "COD Risk", "Frequent", "Bulk Buyer"];

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const list = useServerFn(listMyCustomers);
  const { data } = useQuery({ queryKey: ["admin", "customers"], queryFn: () => list() });
  const [active, setActive] = useState<{ name: string; phone: string } | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="overflow-hidden rounded-xl border bg-card">
        {(data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No customers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-right">Orders</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Last order</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-muted-foreground">{c.phone}</td>
                  <td className="p-3 text-right">{c.orders}</td>
                  <td className="p-3 text-right">৳{c.total.toFixed(0)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.last).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setActive({ name: c.name, phone: c.phone })}>Notes & tags</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {active && <NotesDialog customer={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function NotesDialog({ customer, onClose }: { customer: { name: string; phone: string }; onClose: () => void }) {
  const get = useServerFn(getCustomerNote);
  const save = useServerFn(upsertCustomerNote);
  const qc = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ["customer-note", customer.phone],
    queryFn: () => get({ data: { phone: customer.phone } }),
  });
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) { setTags(existing.tags ?? []); setNote(existing.note ?? ""); }
  }, [existing]);

  function toggleTag(t: string) {
    setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  }
  function addCustom() { if (newTag.trim()) { toggleTag(newTag.trim()); setNewTag(""); } }

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { phone: customer.phone, tags, note } });
      qc.invalidateQueries({ queryKey: ["customer-note", customer.phone] });
      toast.success("Saved");
      onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{customer.name} · {customer.phone}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Tags</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAG_PRESETS.map((t) => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1 text-xs ${tags.includes(t) ? "bg-primary text-primary-foreground" : ""}`}>
                  {t}
                </button>
              ))}
              {tags.filter((t) => !TAG_PRESETS.includes(t)).map((t) => (
                <button key={t} onClick={() => toggleTag(t)} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
                  {t} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input className="h-8" placeholder="Custom tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={addCustom}>Add</Button>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Note</div>
            <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
