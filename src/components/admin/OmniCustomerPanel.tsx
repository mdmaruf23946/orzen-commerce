import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, MapPin, Pencil, Phone, User, X } from "lucide-react";
import { getOmniCustomer, updateOmniCustomer } from "@/lib/omni-inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-accent text-accent-foreground" },
  confirmed: { label: "Confirmed", cls: "bg-secondary text-secondary-foreground" },
  processing: { label: "Processing", cls: "bg-secondary text-secondary-foreground" },
  delivered: { label: "Delivered", cls: "bg-primary/15 text-primary" },
  cancelled: { label: "Cancelled", cls: "bg-destructive/15 text-destructive" },
};

const tk = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

export function OmniCustomerPanel({ conversationId, onClose }: { conversationId: string; onClose?: () => void }) {
  const qc = useQueryClient();
  const fetchCrm = useServerFn(getOmniCustomer);
  const save = useServerFn(updateOmniCustomer);
  const { data, isLoading } = useQuery({
    queryKey: ["omni-crm", conversationId],
    queryFn: () => fetchCrm({ data: { conversationId } }),
    staleTime: 20_000,
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [conversationId]);

  function startEdit() {
    const c = data?.customer;
    setForm({ name: c?.name ?? "", phone: c?.phone ?? "", address: c?.address ?? "" });
    setEditing(true);
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { conversationId, ...form } });
      toast.success("কাস্টমারের তথ্য সেভ হয়েছে");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["omni-crm", conversationId] });
      qc.invalidateQueries({ queryKey: ["omni-inbox"] });
    } catch (e) {
      toast.error((e as Error).message || "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data)
    return (
      <div className="grid h-full place-items-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const { customer: c, stats: s, recent } = data;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.name || "নাম নেই"}</div>
          <div className="text-xs text-muted-foreground">
            প্রথম যোগাযোগ: {c.firstContact ? new Date(c.firstContact).toLocaleDateString() : "—"}
          </div>
        </div>
        {!editing && (
          <Button size="icon" variant="ghost" onClick={startEdit} aria-label="এডিট">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="বন্ধ করুন">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 border-b p-4">
          <Input placeholder="নাম" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="ফোন" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea rows={3} placeholder="ঠিকানা" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}সেভ করুন
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>বাতিল</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 border-b p-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            {c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : <span className="text-muted-foreground">ফোন নেই</span>}
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("break-words", !c.address && "text-muted-foreground")}>{c.address || "ঠিকানা নেই"}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-b p-4">
        <Stat label="মোট অর্ডার" value={String(s.total)} />
        <Stat label="LTV (ডেলিভারড)" value={tk(s.ltv)} />
        <Stat label="ডেলিভারি রেট" value={s.deliveryRate == null ? "—" : `${s.deliveryRate}%`} tone="good" />
        <Stat label="বাতিল রেট" value={s.cancelRate == null ? "—" : `${s.cancelRate}%`} tone={s.cancelRate && s.cancelRate >= 30 ? "bad" : undefined} />
        <div className="col-span-2 flex justify-between text-xs text-muted-foreground">
          <span>ডেলিভারড {s.delivered}</span>
          <span>বাতিল {s.cancelled}</span>
          <span>পেন্ডিং {s.pending}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 text-sm font-semibold">সাম্প্রতিক অর্ডার</div>
        {!c.phone ? (
          <p className="text-xs text-muted-foreground">ফোন নম্বর যোগ করলে অর্ডার হিস্ট্রি দেখা যাবে।</p>
        ) : recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">এই নম্বরে এখনো কোনো অর্ডার নেই।</p>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => {
              const st = STATUS[o.status] ?? { label: o.status, cls: "bg-muted" };
              return (
                <Link
                  key={o.id}
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-xs transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">#{o.invoice_no || o.id.slice(0, 8)}</div>
                    <div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", st.cls)}>
                    {o.followup_status === "on_hold" ? "On hold" : st.label}
                  </span>
                  <span className="font-semibold">{tk(o.total)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold", tone === "good" && "text-primary", tone === "bad" && "text-destructive")}>{value}</div>
    </div>
  );
}
