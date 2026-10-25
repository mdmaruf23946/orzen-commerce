import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourierFinance, markCourierPaid } from "@/lib/courier-parcels.functions";
import { courierLabel, money } from "@/components/admin/couriers/parcel-ui";

export function CourierFinancePanel() {
  const qc = useQueryClient();
  const fetchFin = useServerFn(getCourierFinance);
  const payFn = useServerFn(markCourierPaid);
  const { data } = useQuery({ queryKey: ["courier-finance"], queryFn: () => fetchFin() });
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
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wallet className="h-4 w-4" /> কুরিয়ারের টাকার হিসাব
      </div>
      {data.couriers.length === 0 ? (
        <p className="text-xs text-muted-foreground">এখনও কোনো পার্সেল ডেলিভারি বা রিটার্ন হয়নি।</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.couriers.map((c) => (
            <div key={c.key} className="rounded-lg border p-3 text-xs">
              <div className="mb-2 font-medium">{courierLabel(c.key as any)}</div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">ডেলিভারি / রিটার্ন</span><span className="text-right">{c.delivered} / {c.returned}</span>
                <span className="text-muted-foreground">কাস্টমার থেকে আদায়</span><span className="text-right">{money(c.collected)}</span>
                <span className="text-muted-foreground">কুরিয়ার চার্জ</span><span className="text-right">{money(c.fees)}</span>
                <span className="text-muted-foreground">পেয়েছেন</span><span className="text-right">{money(c.paid)}</span>
                <span className="font-medium">কুরিয়ারের কাছে বাকি</span><span className="text-right font-semibold">{money(c.due)}</span>
              </div>
              {c.due > 0 && (
                <Button size="sm" variant="outline" className="mt-2 w-full" disabled={pay.isPending} onClick={() => pay.mutate(c.key)}>
                  টাকা পেয়েছি
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg bg-muted/50 p-2 text-xs">
        <div className="mb-1 font-medium">সাথে সাথে স্ট্যাটাস পেতে (Webhook URL)</div>
        <p className="mb-1 text-muted-foreground">
          এই লিংকটি কপি করে কুরিয়ারের মার্চেন্ট প্যানেলে Webhook / Callback URL ঘরে বসান (SteadFast, Pathao, RedX ইত্যাদি)। না বসালেও কিছুক্ষণ পরপর নিজে থেকে স্ট্যাটাস আপডেট হয়।
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1">{hook}</code>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(hook).then(() => toast.success("কপি হয়েছে"))}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
