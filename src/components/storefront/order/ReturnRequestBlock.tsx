// Customer-initiated return / exchange request for a delivered order.
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Repeat, X } from "lucide-react";
import { createMyReturnRequest, listMyOrderReturns } from "@/lib/returns.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WINDOW_DAYS = 7;

const STATUS_LABEL: Record<string, string> = {
  requested: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  refunded: "Refunded",
  completed: "Completed",
};

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export function ReturnRequestBlock({ order, slug }: { order: any; slug: string }) {
  const { token } = useCustomerSession(slug);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOrderReturns);
  const createFn = useServerFn(createMyReturnRequest);
  const [type, setType] = useState<"return" | "exchange" | null>(null);

  const { data: requests = [] } = useQuery({
    queryKey: ["my-returns", order.id, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token: token!, orderId: order.id } }),
    enabled: !!token,
  });

  const create = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Request submitted");
      setType(null);
      qc.invalidateQueries({ queryKey: ["my-returns", order.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit request"),
  });

  const timeline: any[] = Array.isArray(order.timeline) ? order.timeline : [];
  const delivered = timeline.find((t) => t.stage === "delivered");
  const withinWindow = delivered
    ? Date.now() - new Date(delivered.created_at).getTime() <= WINDOW_DAYS * 86_400_000
    : false;
  const open = (requests as any[]).some((r) => r.status === "requested" || r.status === "approved");
  const eligible =
    (order.order_type ?? "physical") === "physical" &&
    order.status !== "cancelled" &&
    !!delivered &&
    withinWindow &&
    !open;

  if (!token) return null;
  if (!delivered && (requests as any[]).length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Returns & exchanges</h2>

      {(requests as any[]).map((r) => (
        <div key={r.id} className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium capitalize">{r.type} request</span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </div>
          {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
          {r.resolution_note && <p className="mt-1 text-xs">Store: {r.resolution_note}</p>}
          {Number(r.refund_amount ?? 0) > 0 && (
            <p className="mt-1 text-xs">Refund: ৳{Number(r.refund_amount).toFixed(0)}</p>
          )}
          {r.courier_tracking_id && (
            <p className="mt-1 text-xs text-muted-foreground">
              Return tracking: {r.courier_name ? `${r.courier_name} · ` : ""}
              <span className="font-mono">{r.courier_tracking_id}</span>
            </p>
          )}
        </div>
      ))}

      {eligible ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setType("return")}>
            <RotateCcw className="mr-1 h-4 w-4" /> Request return
          </Button>
          <Button variant="outline" onClick={() => setType("exchange")}>
            <Repeat className="mr-1 h-4 w-4" /> Request exchange
          </Button>
        </div>
      ) : (
        (requests as any[]).length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Requests can be made within {WINDOW_DAYS} days of delivery.
          </p>
        )
      )}

      {type && (
        <RequestDialog
          type={type}
          order={order}
          submitting={create.isPending}
          onClose={() => setType(null)}
          onSubmit={(payload) =>
            create.mutate({ storeSlug: slug, token, orderId: order.id, type, ...payload })
          }
        />
      )}
    </div>
  );
}

function RequestDialog({
  type,
  order,
  submitting,
  onClose,
  onSubmit,
}: {
  type: "return" | "exchange";
  order: any;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const orderItems: any[] = (order.items as any[]) ?? [];
  const [selected, setSelected] = useState<number[]>(orderItems.map((_, i) => i));
  const [reason, setReason] = useState("");
  const [replacementNote, setReplacementNote] = useState("");
  const [images, setImages] = useState<string[]>([]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, 4 - images.length)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const c = await compressImage(f);
        next.push(await toDataUrl(c));
      } catch {
        /* skip */
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, 4));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error("Please describe the reason");
      return;
    }
    onSubmit({
      reason: reason.trim(),
      replacementNote: type === "exchange" ? replacementNote.trim() || undefined : undefined,
      images,
      items: selected.map((i) => ({
        product_id: orderItems[i]?.product_id ?? null,
        name: orderItems[i]?.name_snapshot ?? "Item",
        qty: orderItems[i]?.qty ?? 1,
        price: Number(orderItems[i]?.price_snapshot ?? 0),
      })),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">Request {type}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Items</Label>
            {orderItems.map((it, i) => (
              <label key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, i] : prev.filter((x) => x !== i),
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{it.name_snapshot}</span>
                <span className="text-muted-foreground">×{it.qty}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us what went wrong"
            />
          </div>

          {type === "exchange" && (
            <div className="space-y-1.5">
              <Label>Preferred replacement (optional)</Label>
              <Input
                value={replacementNote}
                onChange={(e) => setReplacementNote(e.target.value)}
                placeholder="e.g. same item, size L"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Photos (optional, up to 4)</Label>
            <Input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="h-16 w-16 rounded-md border object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((p) => p.filter((_, x) => x !== i))}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting || selected.length === 0}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
