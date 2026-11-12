import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listPromoRecipients, sendPromoEmail } from "@/lib/payments/promo-email.functions";
import { DEFAULT_PROMO_BENEFITS, promoDiscountHeadline } from "@/lib/payments/promo-audience";
import { useEffect } from "react";

type Group = "free" | "trial" | "paid" | "all";
const GROUPS: { key: Group; label: string }[] = [
  { key: "free", label: "ফ্রি প্ল্যান" },
  { key: "trial", label: "ট্রায়াল" },
  { key: "paid", label: "পেইড" },
  { key: "all", label: "সবাই" },
];

export function PromoEmailDialog({ coupon, onClose }: { coupon: { id: string; code: string; type?: string; value?: number; plan_amounts?: Record<string, number>; max_discount?: number | null } | null; onClose: () => void }) {
  const listFn = useServerFn(listPromoRecipients);
  const sendFn = useServerFn(sendPromoEmail);
  const { data = [], isLoading } = useQuery({ queryKey: ["owner", "promoRecipients"], queryFn: () => listFn(), enabled: !!coupon });
  const [group, setGroup] = useState<Group>("free");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("🎁 {{owner_name}}, আপনার জন্য {{discount}} — {{validity_text}}");
  const [message, setMessage] = useState("প্রিয় {{owner_name}},\n\n{{store_name}} স্টোরকে আরও বড় করতে আপনার জন্য রয়েছে {{discount}}! প্যাকেজ ও মেয়াদ অনুযায়ী আপনার পছন্দের প্ল্যানে ছাড় পাবেন। অফারটি চলবে {{expiry_date}} পর্যন্ত — {{validity_text}}।\n\nনিচের প্রোমো কোডটি ব্যবহার করে আজই আপনার প্যাকেজ আপগ্রেড করুন।");
  const [sending, setSending] = useState(false);
  const [discountLabel, setDiscountLabel] = useState("");
  const [showBenefits, setShowBenefits] = useState(true);
  const [benefitsTitle, setBenefitsTitle] = useState("আপগ্রেড করলে যা পাবেন:");
  const [benefits, setBenefits] = useState(DEFAULT_PROMO_BENEFITS);
  const autoLabel = coupon ? promoDiscountHeadline({ type: coupon.type ?? "fixed", value: coupon.value ?? 0, plan_amounts: coupon.plan_amounts, max_discount: coupon.max_discount }) : "";
  useEffect(() => { setDiscountLabel(autoLabel); }, [coupon?.id]);

  const rows = useMemo(() => data.filter((r: any) =>
    (group === "all" || r.group === group) &&
    (!q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()))), [data, group, q]);
  const count = (g: Group) => data.filter((r: any) => g === "all" || r.group === g).length;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((r: any) => picked.has(r.id));

  async function send() {
    if (!coupon || picked.size === 0) return;
    if (!confirm(`${picked.size} জন মার্চেন্টকে ইমেইল পাঠাবেন?`)) return;
    setSending(true);
    try {
      const res = await sendFn({ data: { couponId: coupon.id, storeIds: [...picked], subject, message, discountLabel, showBenefits, benefitsTitle, benefits } });
      toast.success(`${res.sent} টি ইমেইল পাঠানো হয়েছে`);
      if (res.failed.length) toast.error(`পাঠানো যায়নি: ${res.failed.join(", ")}`);
      setPicked(new Set());
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  }

  return (
    <Dialog open={!!coupon} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>ইমেইলে পাঠান — <span className="font-mono">{coupon?.code}</span></DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <Button key={g.key} size="sm" variant={group === g.key ? "default" : "outline"} onClick={() => setGroup(g.key)}>
                {g.label} ({count(g.key)})
              </Button>
            ))}
          </div>
          <Input placeholder="স্টোর বা ইমেইল খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="rounded-lg border">
            <label className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
              <input type="checkbox" checked={allOn} onChange={() => setPicked((p) => {
                const n = new Set(p); rows.forEach((r: any) => (allOn ? n.delete(r.id) : n.add(r.id))); return n;
              })} /> এই তালিকার সবাইকে বাছুন
              <span className="ml-auto text-muted-foreground">বাছাই: {picked.size}</span>
            </label>
            <div className="max-h-60 overflow-y-auto">
              {isLoading && <p className="p-3 text-sm text-muted-foreground">লোড হচ্ছে…</p>}
              {!isLoading && rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">কেউ নেই</p>}
              {rows.map((r: any) => (
                <label key={r.id} className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-0">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} disabled={!r.email} />
                  <span className="font-medium">{r.name}</span>
                  <span className="truncate text-muted-foreground">{r.email || "ইমেইল নেই"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.plan}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>মার্চেন্টকে কোন ছাড় দেখাবে</Label>
            <Input value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder={autoLabel} />
            <p className="text-xs text-muted-foreground">নিজে থেকে সবচেয়ে বেশি মাসিক ছাড় বসানো হয়েছে ({autoLabel})। চাইলে নিজের মতো লিখুন, যেমন “৳৫০০ পর্যন্ত ছাড়”।</p>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={showBenefits} onChange={(e) => setShowBenefits(e.target.checked)} /> “আপগ্রেড করলে যা পাবেন” অংশ ইমেইলে দেখাবে</label>
            {showBenefits && (<>
              <Input value={benefitsTitle} onChange={(e) => setBenefitsTitle(e.target.value)} />
              <Textarea rows={3} value={benefits} onChange={(e) => setBenefits(e.target.value)} />
              <p className="text-xs text-muted-foreground">প্রতিটি লাইন একটি করে ✅ পয়েন্ট হবে।</p>
            </>)}
          </div>
          <div className="space-y-1"><Label>বিষয় (Subject)</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>মেসেজ</Label>
            <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-muted-foreground">{"{{owner_name}} {{store_name}} {{code}} {{discount}} {{expiry_date}} {{days_left}} {{validity_text}}"} লিখলে নিজে বসে যাবে (নাম = মার্চেন্টের নিজের নাম)। মেয়াদ ও শেষ তারিখ ইমেইলে আলাদা করে দেখাবে। প্রোমো কোডটি ইমেইলে বড় করে দেখাবে। notify@orzen.top থেকে যাবে।</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>বাতিল</Button>
            <Button onClick={send} disabled={sending || picked.size === 0}>{sending ? "পাঠানো হচ্ছে…" : `${picked.size} জনকে পাঠান`}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
