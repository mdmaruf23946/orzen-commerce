import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { listStaff, upsertStaff, deleteStaff } from "@/lib/staff.functions";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffPage,
  head: () => ({
    meta: [
      { title: "Staff Management — ORZEN Merchant Panel" },
      { name: "description", content: "Invite and manage staff members who help run your ORZEN store." },
      { property: "og:title", content: "Staff Management — ORZEN Merchant Panel" },
      { property: "og:description", content: "Invite and manage staff members who help run your ORZEN store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Staff = {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; status: string; notes: string | null; created_at: string;
};

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent" },
  { value: "viewer", label: "Viewer" },
];
const STATUSES = [
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const emptyForm = { id: "", name: "", email: "", phone: "", role: "agent", status: "invited", notes: "" };

function StaffPage() {
  const load = useServerFn(listStaff);
  const save = useServerFn(upsertStaff);
  const remove = useServerFn(deleteStaff);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["admin", "staff"], queryFn: () => load() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const rows = ((data as any)?.rows ?? []) as Staff[];
  const limit = Number((data as any)?.limit ?? 0);

  function edit(s: Staff) {
    setForm({
      id: s.id, name: s.name, email: s.email ?? "", phone: s.phone ?? "",
      role: s.role, status: s.status, notes: s.notes ?? "",
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await save({ data: { ...(form.id ? { id: form.id } : {}), name: form.name, email: form.email || undefined, phone: form.phone || undefined, role: form.role as any, status: form.status as any, notes: form.notes || undefined } });
      toast.success(form.id ? "Staff updated" : "Staff added");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Remove this staff member?")) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <UserCog className="h-5 w-5" /> Staff
          </h1>
          <p className="text-sm text-muted-foreground">
            People who help you run the store. {limit > 0 ? `Plan limit: ${rows.length}/${limit}` : "Unlimited on your plan."}
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Add staff
        </Button>
      </div>

      <FeatureGate feature="staff">
        <div className="rounded-2xl border bg-card">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No staff members yet. Add your first team member.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[s.email, s.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize">{s.role}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${s.status === "active" ? "bg-emerald-500/10 text-emerald-600" : s.status === "suspended" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                      {s.status}
                    </span>
                    <button onClick={() => edit(s)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => del(s.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FeatureGate>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit staff" : "Add staff"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
