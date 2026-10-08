import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Mail, ShieldCheck, Store, UserPlus, Users } from "lucide-react";
import { AccountAvatar } from "@/components/admin/AccountAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  cancelInvite,
  getAccessOverview,
  inviteAccess,
  leaveStore,
  resendInvite,
  respondInvite,
  revokeAccess,
  switchStore,
  updateAccess,
} from "@/lib/delegated-access.functions";
import {
  DELEGATE_ROLES,
  GRANTABLE_SECTIONS,
  SECTION_BY_KEY,
  delegatePresetPermissions,
  type DelegateRole,
  type PermissionMap,
} from "@/lib/panel-sections";
import { setActiveStoreId } from "@/lib/active-store";

const roleLabel = (r: string) => DELEGATE_ROLES.find((x) => x.value === r)?.label ?? r;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function permSummary(p: Record<string, string> | null | undefined) {
  const keys = Object.keys(p ?? {});
  if (!keys.length) return "No sections";
  const names = keys.slice(0, 3).map((k) => SECTION_BY_KEY[k]?.label ?? k);
  return names.join(", ") + (keys.length > 3 ? ` +${keys.length - 3}` : "");
}

function StatusBadge({ status, expires }: { status: string; expires?: string | null }) {
  const expired = expires && new Date(expires).getTime() <= Date.now();
  if (expired) return <Badge variant="outline">Expired</Badge>;
  if (status === "active") return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Access granted</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  return <Badge variant="outline" className="text-destructive">Revoked</Badge>;
}

function PermissionEditor({ value, onChange }: { value: PermissionMap; onChange: (v: PermissionMap) => void }) {
  const groups = Array.from(new Set(GRANTABLE_SECTIONS.map((s) => s.group)));
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</div>
          {GRANTABLE_SECTIONS.filter((s) => s.group === g && s.key !== "profile").map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span className="truncate">{s.label}</span>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={value[s.key] ?? "none"}
                onChange={(e) => {
                  const next = { ...value };
                  if (e.target.value === "none") delete next[s.key];
                  else next[s.key] = e.target.value as any;
                  onChange(next);
                }}
              >
                <option value="none">No access</option>
                <option value="view">View only</option>
                <option value="manage">Manage</option>
              </select>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

type FormState = { email: string; displayName: string; role: DelegateRole; permissions: PermissionMap; expires: string };
const emptyForm = (): FormState => ({
  email: "",
  displayName: "",
  role: "support_manager",
  permissions: delegatePresetPermissions("support_manager"),
  expires: "",
});

export function AccessPermissionsSection() {
  const qc = useQueryClient();
  const load = useServerFn(getAccessOverview);
  const invite = useServerFn(inviteAccess);
  const resend = useServerFn(resendInvite);
  const cancel = useServerFn(cancelInvite);
  const update = useServerFn(updateAccess);
  const revoke = useServerFn(revokeAccess);
  const respond = useServerFn(respondInvite);
  const leave = useServerFn(leaveStore);
  const doSwitch = useServerFn(switchStore);
  const { data, isLoading } = useQuery({ queryKey: ["access", "overview"], queryFn: () => load() });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["access"] });
  };

  async function run<T>(fn: () => Promise<T>, ok: string) {
    try {
      const r = await fn();
      toast.success(ok);
      refresh();
      return r;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r: any = await run(
      () =>
        invite({
          data: {
            email: form.email,
            displayName: form.displayName || null,
            role: form.role,
            permissions: form.permissions,
            accessExpiresAt: form.expires ? new Date(form.expires + "T23:59:59").toISOString() : null,
          },
        }),
      "Invitation sent",
    );
    setBusy(false);
    if (r) {
      setLastLink(r.emailed ? null : r.link);
      if (!r.emailed) toast.info("ইমেইল পাঠানো যায়নি — নিচের লিংকটি কপি করে পাঠান।");
      setForm(emptyForm());
    }
  }

  async function openStore(storeId: string) {
    try {
      const r = await doSwitch({ data: { storeId } });
      setActiveStoreId(r.storeId);
      window.location.assign("/admin");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const people = (data?.people ?? []) as any[];
  const sent = (data?.sent ?? []) as any[];
  const incoming = (data?.incoming ?? []) as any[];
  const mine = (data?.mine ?? []) as any[];
  const pendingCount = sent.length + incoming.length;

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Access & Permissions</h2>
          <p className="text-xs text-muted-foreground">
            পাসওয়ার্ড শেয়ার না করে অন্য মার্চেন্ট বা ইউজারকে আপনার স্টোরে নির্দিষ্ট অনুমতি দিন।
          </p>
        </div>
      </div>

      <Tabs defaultValue={incoming.length ? "pending" : "people"} className="p-4 sm:p-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="mine"><Store className="mr-1.5 h-3.5 w-3.5" />My Access</TabsTrigger>
          <TabsTrigger value="people"><Users className="mr-1.5 h-3.5 w-3.5" />People With Access</TabsTrigger>
          <TabsTrigger value="pending">
            <Mail className="mr-1.5 h-3.5 w-3.5" />Pending{pendingCount ? ` (${pendingCount})` : ""}
          </TabsTrigger>
          {data?.isOwner && <TabsTrigger value="give"><UserPlus className="mr-1.5 h-3.5 w-3.5" />Give Access</TabsTrigger>}
        </TabsList>

        {isLoading && <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted/40" />}

        <TabsContent value="mine" className="mt-4 space-y-2">
          {mine.length === 0 && <Empty text="অন্য কোনো স্টোরে আপনার অ্যাক্সেস নেই।" />}
          {mine.map((m) => {
            const active = m.status === "active" && !(m.expires_at && new Date(m.expires_at).getTime() <= Date.now());
            return (
              <Row
                key={m.id}
                left={<StoreIcon name={m.store_name} />}
                title={m.store_name}
                subtitle={`${roleLabel(m.role)} · ${permSummary(m.permissions)}`}
                meta={<StatusBadge status={m.status} expires={m.expires_at} />}
                actions={
                  active ? (
                    <>
                      <Button size="sm" onClick={() => openStore(m.store_id)}>Open store</Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm("এই স্টোর থেকে বেরিয়ে যাবেন?") && run(() => leave({ data: { id: m.id } }), "Left store")}>Leave</Button>
                    </>
                  ) : null
                }
              />
            );
          })}
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-2">
          {!data?.isOwner && <Empty text="শুধু স্টোরের মালিক অ্যাক্সেস দেখতে ও ম্যানেজ করতে পারেন।" />}
          {data?.isOwner && people.length === 0 && <Empty text="এখনো কাউকে অ্যাক্সেস দেওয়া হয়নি।" />}
          {people.map((p) => (
            <Row
              key={p.id}
              left={<AccountAvatar avatarUrl={p.avatar} name={p.name} className="h-9 w-9" />}
              title={p.name}
              subtitle={`${p.email ?? ""} · ${roleLabel(p.role)} · ${permSummary(p.permissions)}`}
              meta={
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={p.status} expires={p.expires_at} />
                  <span className="text-[11px] text-muted-foreground">Last active: {fmt(p.last_active_at)}</span>
                </div>
              }
              actions={
                p.status === "active" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, permissions: p.permissions ?? {}, expires: p.expires_at ? p.expires_at.slice(0, 10) : "" })}>Manage</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`${p.email}-এর অ্যাক্সেস বাতিল করবেন?`) && run(() => revoke({ data: { id: p.id } }), "Access revoked")}>Revoke</Button>
                  </>
                ) : null
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">আপনার জন্য আমন্ত্রণ</div>
            {incoming.length === 0 && <Empty text="কোনো আমন্ত্রণ নেই।" />}
            {incoming.map((i) => (
              <Row
                key={i.id}
                left={<StoreIcon name={i.store_name} />}
                title={i.store_name}
                subtitle={`${i.invited_by_name ?? "Merchant"} · ${roleLabel(i.role)} · ${permSummary(i.permissions)}`}
                meta={<StatusBadge status="pending" />}
                actions={
                  <>
                    <Button size="sm" onClick={() => run(() => respond({ data: { id: i.id, accept: true } }), "Access accepted")}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => run(() => respond({ data: { id: i.id, accept: false } }), "Invitation declined")}>Decline</Button>
                  </>
                }
              />
            ))}
          </div>
          {data?.isOwner && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">আপনার পাঠানো আমন্ত্রণ</div>
              {sent.length === 0 && <Empty text="কোনো pending আমন্ত্রণ নেই।" />}
              {sent.map((s) => (
                <Row
                  key={s.id}
                  left={<AccountAvatar avatarUrl={null} name={s.display_name || s.email} className="h-9 w-9" />}
                  title={s.display_name || s.email}
                  subtitle={`${s.email} · ${roleLabel(s.role)} · expires ${fmt(s.expires_at)}`}
                  meta={<StatusBadge status="pending" />}
                  actions={
                    <>
                      <Button size="sm" variant="outline" onClick={async () => {
                        const r: any = await run(() => resend({ data: { id: s.id } }), "Invitation resent");
                        if (r && !r.emailed) setLastLink(r.link);
                      }}>Resend</Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => cancel({ data: { id: s.id } }), "Invitation cancelled")}>Cancel</Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {data?.isOwner && (
          <TabsContent value="give" className="mt-4">
            <form onSubmit={submitInvite} className="space-y-4">
              <h3 className="text-sm font-semibold">Give Merchant Panel Access</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Display name (optional)</Label>
                  <Input value={form.displayName} maxLength={80} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value as DelegateRole;
                      setForm({ ...form, role, permissions: role === "custom" ? {} : delegatePresetPermissions(role) });
                    }}
                  >
                    {DELEGATE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Access expiration (optional)</Label>
                  <Input type="date" value={form.expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Permissions</Label>
                <PermissionEditor value={form.permissions} onChange={(p) => setForm({ ...form, role: "custom", permissions: p })} />
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                প্রোফাইল, ইমেইল, পাসওয়ার্ড, 2FA, অ্যাকাউন্ট রিকভারি/ডিলিট, মালিকানা হস্তান্তর আর অ্যাক্সেস ম্যানেজমেন্ট সবসময় শুধু আপনার কাছে থাকবে — আমন্ত্রিত ব্যক্তি অন্য কাউকে অ্যাক্সেস দিতে পারবেন না।
              </p>
              <div className="flex justify-end">
                <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>
              </div>
            </form>
          </TabsContent>
        )}

        {lastLink && (
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs">
            <div className="mb-1 font-medium">Invitation link</div>
            <div className="flex gap-2">
              <Input readOnly value={lastLink} className="text-xs" />
              <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(lastLink); toast.success("Copied"); }}>Copy</Button>
            </div>
          </div>
        )}
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage access — {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={editing.role}
                    onChange={(e) => {
                      const role = e.target.value as DelegateRole;
                      setEditing({ ...editing, role, permissions: role === "custom" ? editing.permissions : delegatePresetPermissions(role) });
                    }}
                  >
                    {DELEGATE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Access expiration</Label>
                  <Input type="date" value={editing.expires} onChange={(e) => setEditing({ ...editing, expires: e.target.value })} />
                </div>
              </div>
              <PermissionEditor value={editing.permissions} onChange={(p) => setEditing({ ...editing, role: "custom", permissions: p })} />
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={async () => {
                const r = await run(
                  () =>
                    update({
                      data: {
                        id: editing.id,
                        role: editing.role,
                        permissions: editing.permissions,
                        accessExpiresAt: editing.expires ? new Date(editing.expires + "T23:59:59").toISOString() : null,
                      },
                    }),
                  "Access updated",
                );
                if (r) setEditing(null);
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">{text}</div>;
}

function StoreIcon({ name }: { name: string }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
      {name?.charAt(0).toUpperCase() || "S"}
    </div>
  );
}

function Row({ left, title, subtitle, meta, actions }: { left: React.ReactNode; title: string; subtitle: string; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {left}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        {meta}
        {actions}
      </div>
    </div>
  );
}
