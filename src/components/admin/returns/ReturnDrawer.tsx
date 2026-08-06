import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Package, Truck } from "lucide-react";
import { updateReturnRequest, listInventory } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUSES = ["requested", "approved", "rejected", "refunded", "completed"] as const;

function img(p?: string | null) {
  if (!p) return null;
  const raw = p.trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

export function ReturnDrawer({
  request,
  onClose,
}: {
  request: any | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateReturnRequest);
  const productsFn = useServerFn(listInventory);
  const { data: products } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => productsFn(),
    enabled: !!request && request.type === "exchange",
  });

  const [note, setNote] = useState<string>(request?.resolution_note ?? "");
  const [refund, setRefund] = useState<number>(Number(request?.refund_amount ?? 0));
  const [replacement, setReplacement] = useState<string>(request?.replacement_product_id ?? "");
  const [courier, setCourier] = useState<string>(request?.courier_name ?? "");
  const [tracking, setTracking] = useState<string>(request?.courier_tracking_id ?? "");

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) =>
      update({ data: { id: request.id, ...patch } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Request updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  if (!request) return null;
  const isExchange = request.type === "exchange";

  function saveDetails(extra: Record<string, any> = {}) {
    save.mutate({
      resolution_note: note,
      refund_amount: Number(refund) || 0,
      replacement_product_id: isExchange ? replacement || null : null,
      courier_name: courier,
      courier_tracking_id: tracking,
      ...extra,
    });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="capitalize">{request.type} request</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 pb-10">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-mono text-xs text-muted-foreground">
              {request.orders?.invoice_no ?? request.order_id.slice(0, 8).toUpperCase()}
            </div>
            <div className="font-medium">{request.customer_name ?? request.orders?.customer_name}</div>
            <div className="text-xs text-muted-foreground">{request.phone ?? request.orders?.phone}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(request.created_at).toLocaleString()}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Products</div>
            <ul className="space-y-2">
              {(request.items ?? []).map((it: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                    {img(it.image) ? (
                      <img src={img(it.image)!} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  <span className="text-muted-foreground">×{it.qty}</span>
                </li>
              ))}
            </ul>
          </div>

          {request.reason && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Reason</div>
              <p className="rounded-md border bg-card p-2 text-sm">{request.reason}</p>
            </div>
          )}

          {request.replacement_note && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Customer replacement note
              </div>
              <p className="rounded-md border bg-card p-2 text-sm">{request.replacement_note}</p>
            </div>
          )}

          {(request.images ?? []).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Photos</div>
              <div className="flex flex-wrap gap-2">
                {(request.images as string[]).map((p) => (
                  <a key={p} href={img(p)!} target="_blank" rel="noreferrer">
                    <img src={img(p)!} alt="Return evidence" className="h-20 w-20 rounded-md border object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => saveDetails({ status: "approved" })}
            >
              <Check className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => saveDetails({ status: "rejected" })}
            >
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              value={request.status}
              onChange={(e) => save.mutate({ status: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Resolution note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {!isExchange && (
            <div className="space-y-1.5">
              <Label>Refund amount (৳)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={refund}
                onChange={(e) => setRefund(Number(e.target.value))}
              />
            </div>
          )}

          {isExchange && (
            <div className="space-y-1.5">
              <Label>Replacement product</Label>
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Not assigned</option>
                {((products as any[]) ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> Return tracking
            </Label>
            <Input placeholder="Courier name" value={courier} onChange={(e) => setCourier(e.target.value)} />
            <Input
              placeholder="Tracking ID"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={save.isPending} onClick={() => saveDetails()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
