import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog, KeyRound, Search, ShieldCheck } from "lucide-react";
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee, resetEmployeePassword,
} from "@/lib/employees.functions";
import {
  GRANTABLE_SECTIONS, EMPLOYEE_ROLES, presetPermissions,
  type PermissionLevel, type PermissionMap, type EmployeeRole,
} from "@/lib/panel-sections";
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

export const Route = createFileRoute("/_authenticated/admin/employees")({
  component: EmployeesPage,
  head: () => ({
    meta: [
      { title: "Employees & Team — ORZEN Merchant Panel" },
      { name: "description", content: "Create employee accounts, assign roles and control exactly which Merchant Panel sections each team member can use." },
      { property: "og:title", content: "Employees & Team — ORZEN Merchant Panel" },
      { property: "og:description", content: "Create employee accounts, assign roles and control which Merchant Panel sections each team member can use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Employee = {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; status: string; notes: string | null; employee_code: string | null;
  permissions: PermissionMap | null; last_login_at: string | null; created_at: string;
};

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];

const emptyForm = {
  id: "", name: "", email: "", phone: "", password: "",
  role: "order_agent" as EmployeeRole, status: "active", notes: "",
  permissions: presetPermissions("order_agent") as PermissionMap,
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function statusClass(s: string) {
  if (s === "active") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (s === "suspended") return "bg-destructive/10 text-destructive";
  return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function EmployeesPage() {
  const load = useServerFn(listEmployees);
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);
  const remove = useServerFn(deleteEmployee);
  const resetPw = useServerFn(resetEmployeePassword);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["admin", "employees"], queryFn: () => load() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pwFor, setPwFor] = useState<Employee | null>(null);
  const [newPw, setNewPw] = useState("");

  const rows = ((data as any)?.rows ?? []) as Employee[];
  const limit = Number((data as any)?.limit ?? 0);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const hit = !q ||
          [r.name, r.email, r.employee_code].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());
        const st = statusFilter === "all" || r.status === statusFilter;
        return hit && st;
      }),
    [rows, q, statusFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof GRANTABLE_SECTIONS>();
    for (const s of GRANTABLE_SECTIONS) {
      map.set(s.group, [...(map.get(s.group) ?? []), s]);
    }
    return [...map.entries()];
  }, []);

  function openCreate() {
    setForm({ ...emptyForm, password: randomPassword(), permissions: presetPermissions("order_agent") });
    setOpen(true);
  }

  function openEdit(e: Employee) {
    setForm({
      id: e.id, name: e.name, email: e.email ?? "", phone: e.phone ?? "", password: "",
      role: (e.role as EmployeeRole) ?? "custom", status: e.status, notes: e.notes ?? "",
      permissions: (e.permissions ?? {}) as PermissionMap,
    });
    setOpen(true);
  }

  function setRole(role: EmployeeRole) {
    setForm((f) => ({ ...f, role, permissions: role === "custom" ? f.permissions : presetPermissions(role) }));
  }

  function setLevel(key: string, level: PermissionLevel) {
    setForm((f) => {
      const next = { ...f.permissions };
      if (level === "none") delete next[key];
      else next[key] = level;
      return { ...f, permissions: next, role: "custom" };
    });
  }

  function bulk(level: PermissionLevel) {
    const next: PermissionMap = {};
    if (level !== "none") for (const s of GRANTABLE_SECTIONS) next[s.key] = level;
    setForm((f) => ({ ...f, permissions: next, role: "custom" }));
  }

  async function submit() {
    if (!form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      if (form.id) {
        await update({
          data: {
            id: form.id, name: form.name, phone: form.phone || undefined,
            role: form.role, status: form.status as any, notes: form.notes || undefined,
            permissions: form.permissions as any,
          },
        });
        toast.success("Employee updated");
      } else {
        if (!form.email.trim()) throw new Error("Email is required");
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters");
        await create({
          data: {
            name: form.name, email: form.email, phone: form.phone || undefined,
            password: form.password, role: form.role, status: form.status as any,
            notes: form.notes || undefined, permissions: form.permissions as any,
            mustChangePassword: true,
          },
        });
        toast.success("Employee account created");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "employees"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(e: Employee) {
    if (!confirm(`Remove ${e.name}? Their login will stop working immediately.`)) return;
    try {
      await remove({ data: { id: e.id } });
      toast.success("Employee removed");
      qc.invalidateQueries({ queryKey: ["admin", "employees"] });
    } catch (err) { toast.error((err as Error).message); }
  }

  async function savePassword() {
    if (!pwFor) return;
    if (newPw.length < 8) return toast.error("Password must be at least 8 characters");
    try {
      await resetPw({ data: { id: pwFor.id, password: newPw, mustChangePassword: true } });
      toast.success("Password updated");
      setPwFor(null);
      setNewPw("");
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <UserCog className="h-5 w-5" /> Employees &amp; Team
          </h1>
          <p className="text-sm text-muted-foreground">
            Give your team their own login with only the access they need.
            {limit > 0 ? ` Plan limit: ${rows.length}/${limit}` : " Unlimited on your plan."}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add employee
        </Button>
      </div>

      <FeatureGate feature="staff">
        <div className="flex flex-wrap gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input className="border-0 focus-visible:ring-0" placeholder="Search name, email or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 rounded-2xl border bg-card">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No employees yet. Add your first team member.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {e.name}
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {e.employee_code ?? "—"}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[e.email, e.phone].filter(Boolean).join(" · ") || "No contact info"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Last login: {e.last_login_at ? new Date(e.last_login_at).toLocaleString() : "never"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize">
                      {(EMPLOYEE_ROLES.find((r) => r.value === e.role)?.label) ?? e.role}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(e.status)}`}>
                      {e.status}
                    </span>
                    <button onClick={() => { setPwFor(e); setNewPw(randomPassword()); }} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Reset password">
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openEdit(e)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => del(e)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FeatureGate>

      {/* Add / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-[22rem] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{form.id ? "Edit employee" : "Add employee"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div><Label className="text-xs sm:text-sm">Name</Label><Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>

              <div>
                <Label className="text-xs sm:text-sm">Work email {form.id ? "" : "(login)"}</Label>
                <Input className="h-9 text-sm" type="email" value={form.email} disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div><Label className="text-xs sm:text-sm">Phone</Label><Input className="h-9 text-sm" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              {!form.id && (
                <div>
                  <Label className="text-xs sm:text-sm">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input className="h-9 text-sm" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, password: randomPassword() })}>
                      New
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs sm:text-sm">Role</Label>
                <Select value={form.role} onValueChange={(v) => setRole(v as EmployeeRole)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {EMPLOYEE_ROLES.find((r) => r.value === form.role)?.description}
                </p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs sm:text-sm"><ShieldCheck className="h-3.5 w-3.5" /> Section permissions</Label>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => bulk("manage")}>All manage</Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => bulk("view")}>All view</Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => bulk("none")}>Clear</Button>
                </div>
              </div>
              <div className="max-h-[38vh] space-y-2.5 overflow-y-auto rounded-xl border p-2 sm:max-h-none sm:p-3">
                {groups.map(([group, items]) => (
                  <div key={group}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                    <div className="grid gap-1">
                      {items.map((s) => {
                        const lvl: PermissionLevel = (form.permissions[s.key] as PermissionLevel) ?? "none";
                        return (
                          <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1">
                            <span className="min-w-0 truncate text-[12px] sm:text-sm">{s.label}</span>
                            <div className="flex shrink-0 overflow-hidden rounded-md border text-[10px] sm:text-[11px]">
                              {(["none", "view", "manage"] as PermissionLevel[]).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setLevel(s.key, v)}
                                  className={`px-1.5 py-0.5 capitalize transition sm:px-2 sm:py-1 ${lvl === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                >
                                  {v === "none" ? "None" : v}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Billing, subscription, store settings, domains, payment gateway and this team page always stay owner-only.
              </p>
            </div>

            <div><Label className="text-xs sm:text-sm">Notes</Label><Textarea rows={2} className="text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          </div>

          <DialogFooter>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!pwFor} onOpenChange={(o) => !o && setPwFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset password — {pwFor?.name}</DialogTitle></DialogHeader>
          <div>
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={() => setNewPw(randomPassword())}>New</Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Share this with the employee — they will be asked to change it after signing in.
            </p>
          </div>
          <DialogFooter><Button onClick={savePassword}>Update password</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
