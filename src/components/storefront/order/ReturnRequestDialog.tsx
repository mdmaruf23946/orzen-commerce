// Shared customer return / exchange request modal.
// Used from the order details page and from the My Orders list.
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type RequestPayload = {
  type: "return" | "exchange";
  reason: string;
  note?: string;
  replacementNote?: string;
  images: string[];
  items: { product_id: string | null; name: string; qty: number; price: number }[];
};

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

export function ReturnRequestDialog({
  initialType,
  items: orderItems,
  submitting,
  onClose,
  onSubmit,
}: {
  initialType: "return" | "exchange";
  items: any[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: RequestPayload) => void;
}) {
  const [type, setType] = useState<"return" | "exchange">(initialType);
  const [selected, setSelected] = useState<number[]>(orderItems.map((_, i) => i));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
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
      type,
      reason: reason.trim(),
      note: note.trim() || undefined,
      replacementNote: type === "exchange" ? replacementNote.trim() || undefined : undefined,
      images,
      items: selected.map((i) => ({
        product_id: orderItems[i]?.product_id ?? null,
        name: orderItems[i]?.name_snapshot ?? orderItems[i]?.name ?? "Item",
        qty: Number(orderItems[i]?.qty ?? 1),
        price: Number(orderItems[i]?.price_snapshot ?? orderItems[i]?.price ?? 0),
      })),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request return or exchange</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Request type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["return", "exchange"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                    type === t
                      ? "border-foreground bg-foreground text-background"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {orderItems.length > 0 && (
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
                  <span className="min-w-0 flex-1 truncate">
                    {it.name_snapshot ?? it.name}
                  </span>
                  <span className="text-muted-foreground">×{it.qty ?? 1}</span>
                </label>
              ))}
            </div>
          )}

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
            <Label>Additional note (optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else the store should know"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Photos (optional, up to 4)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
            />
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

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || (orderItems.length > 0 && selected.length === 0)}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shared read-only view of a submitted request. */
export function ReturnStatusCard({ r }: { r: any }) {
  const STATUS_LABEL: Record<string, string> = {
    requested: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    refunded: "Refunded",
    completed: "Completed",
  };
  const rp = r.replacement_product;
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium capitalize">{r.type} request</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>
      {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
      {r.customer_note && <p className="mt-1 text-xs text-muted-foreground">{r.customer_note}</p>}
      {r.resolution_note && <p className="mt-1 text-xs">Store: {r.resolution_note}</p>}
      {Number(r.refund_amount ?? 0) > 0 && (
        <p className="mt-1 text-xs">Refund: ৳{Number(r.refund_amount).toFixed(0)}</p>
      )}
      {rp && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-background p-2">
          {rp.image && (
            <img
              src={rp.image.startsWith("http") || rp.image.startsWith("/") ? rp.image : `/api/img/${rp.image}`}
              alt=""
              className="h-9 w-9 rounded object-cover"
            />
          )}
          <span className="min-w-0 flex-1 truncate text-xs">Replacement: {rp.name}</span>
        </div>
      )}
      {r.courier_tracking_id && (
        <p className="mt-1 text-xs text-muted-foreground">
          Return tracking: {r.courier_name ? `${r.courier_name} · ` : ""}
          <span className="font-mono">{r.courier_tracking_id}</span>
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Requested {new Date(r.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
