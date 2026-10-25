import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CourierLogo } from "./CourierLogo";
import { getCourierFinance, markCourierPaid, getCourierBalances } from "@/lib/courier-parcels.functions";
import { courierLabel, money } from "@/components/admin/couriers/parcel-ui";

export function CourierFinancePanel() {
  const qc = useQueryClient();
  const fetchFin = useServerFn(getCourierFinance);
  const payFn = useServerFn(markCourierPaid);
  const { data } = useQuery({ queryKey: ["courier-finance"], queryFn: () => fetchFin() });
  const fetchBal = useServerFn(getCourierBalances);
  const { data: bal } = useQuery({ queryKey: ["courier-balances"], queryFn: () => fetchBal(), staleTime: 60_000 });
  const pay = useMutation({
    mutationFn: (key: string) => payFn({ data: { courierKey: key as any } }),
    onSuccess: (r) => {
      toast.success(`${r.count}টি পার্সেলের টাকা পেয়েছেন হিসেবে রাখা হলো`);
      qc.invalidateQueries({ queryKey: ["courier-finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  const hook = typeof window !== "undefined" ? `${window.location.origin}${data.webhookPath}` : data.webhookPath;
  const balOf = (k: string) => bal?.balances?.find((b) => b.key === k);
  const keys = Array.from(new Set([...(data.couriers.map((c) => c.key) as string[]), ...((bal?.balances ?? []).map((b) => b.key) as string[])]));
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
      <span className="flex items-center gap-1.5 px-1 text-xs font-semibold"><Wallet className="h-4 w-4" /> টাকার হিসাব</span>
      {keys.length === 0 && <span className="text-xs text-muted-foreground">এখনও কোনো ডেলিভারি হয়নি</span>}
      {keys.map((k) => {
        const c = data.couriers.find((x) => x.key === k);
        const b = balOf(k);
        return (
          <Popover key={k}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-10 items-center gap-2 rounded-lg border px-2.5 text-xs hover:bg-muted">
                <CourierLogo courierKey={k} className="h-6 w-6" />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] text-muted-foreground">{b?.balance != null ? "জমা" : "বাকি"}</span>
                  <span className="block font-bold">{b?.balance != null ? money(b.balance) : money(c?.due ?? 0)}</span>
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 text-xs">
              <div className="mb-2 font-semibold">{courierLabel(k as any)}</div>
              {b && <div className="mb-2 flex justify-between rounded bg-muted px-2 py-1"><span>অ্যাকাউন্টে জমা</span><b>{b.balance != null ? money(b.balance) : b.error}</b></div>}
              {c && (
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-muted-foreground">ডেলিভারি / রিটার্ন</span><span className="text-right">{c.delivered} / {c.returned}</span>
                  <span className="text-muted-foreground">কাস্টমার থেকে আদায়</span><span className="text-right">{money(c.collected)}</span>
                  <span className="text-muted-foreground">কুরিয়ার চার্জ</span><span className="text-right">{money(c.fees)}</span>
                  <span className="text-muted-foreground">পেয়েছেন</span><span className="text-right">{money(c.paid)}</span>
                  <span className="font-medium">বাকি</span><span className="text-right font-semibold">{money(c.due)}</span>
                </div>
              )}
              {c && c.due > 0 && (
                <Button size="sm" variant="outline" className="mt-2 w-full" disabled={pay.isPending} onClick={() => pay.mutate(c.key)}>টাকা পেয়েছি</Button>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="ml-auto h-8 rounded-lg border px-2.5 text-[11px] text-muted-foreground hover:bg-muted">Webhook URL</button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 text-xs">
          <p className="mb-2 text-muted-foreground">এই লিংকটি কুরিয়ারের মার্চেন্ট প্যানেলে Webhook / Callback URL ঘরে বসান। না বসালেও কিছুক্ষণ পরপর স্ট্যাটাস আপডেট হয়।</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1">{hook}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(hook).then(() => toast.success("কপি হয়েছে"))}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
