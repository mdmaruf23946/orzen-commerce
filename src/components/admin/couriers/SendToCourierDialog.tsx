// Confirmation dialog for pushing a confirmed order to the connected courier.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { F, Two, courierLabel, money } from "@/components/admin/couriers/parcel-ui";
import { sendOrderToCourier } from "@/lib/courier-parcels.functions";
import type { CourierKey } from "@/components/admin/couriers/providers";

type ConnectedCourier = {
  key: CourierKey;
  isDefault: boolean;
  sandbox: boolean;
  pickup: Record<string, string | undefined>;
  manual: boolean;
};

export function SendToCourierDialog({
  order,
  couriers,
  defaultKey,
  onOpenChange,
  onSent,
}: {
  order: any | null;
  couriers: ConnectedCourier[];
  defaultKey: CourierKey | null;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const send = useServerFn(sendOrderToCourier);
  const [courierKey, setCourierKey] = useState<CourierKey | "">("");
  const [weight, setWeight] = useState("0.5");
  const [deliveryType, setDeliveryType] = useState("home");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) setCourierKey((defaultKey ?? couriers[0]?.key ?? "") as CourierKey | "");
  }, [order, defaultKey, couriers]);

  const cfg = couriers.find((c) => c.key === courierKey);
  const pickup = cfg?.pickup ?? {};
  const pickupLabel =
    [pickup.contactName, pickup.address, pickup.district].filter(Boolean).join(", ") ||
    "Default pickup location";

  async function submit() {
    if (!order || !courierKey) return;
    setBusy(true);
    try {
      const r: any = await send({
        data: {
          orderId: order.id,
          courierKey: courierKey as CourierKey,
          weight: Number(weight) || undefined,
          deliveryType,
        },
      });
      toast.success(r?.trackingCode ? `Parcel created · ${r.trackingCode}` : "Parcel created");
      onSent();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send to courier</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border p-3">
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-xs text-muted-foreground">{order.phone}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[order.address, order.area].filter(Boolean).join(", ")}
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Products</p>
              {(order.items ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                (order.items ?? []).map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate">
                      {i.name} × {i.qty}
                    </span>
                    <span>{money(i.price)}</span>
                  </div>
                ))
              )}
              <div className="mt-2 flex justify-between border-t pt-2 text-xs">
                <span>COD amount</span>
                <strong>{money(order.cod_amount)}</strong>
              </div>
            </div>

            <Two>
              <F label="Courier">
                <Select value={courierKey} onValueChange={(v) => setCourierKey(v as CourierKey)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent>
                    {couriers.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {courierLabel(c.key)}
                        {c.isDefault ? " · Default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Delivery type">
                <Select value={deliveryType} onValueChange={setDeliveryType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home delivery</SelectItem>
                    <SelectItem value="pickup_point">Pickup point</SelectItem>
                    <SelectItem value="return">Return delivery</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            </Two>

            <Two>
              <F label="Package weight (kg)">
                <Input
                  className="h-9"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </F>
              <F label="Pickup location">
                <Input className="h-9" value={pickupLabel} readOnly />
              </F>
            </Two>

            {cfg?.manual && (
              <p className="text-[11px] text-muted-foreground">
                {courierLabel(courierKey || "")} has no public API — the parcel is recorded locally and you
                can add the consignment number afterwards.
              </p>
            )}
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !courierKey} onClick={submit}>
            <Send className="mr-1 h-4 w-4" /> Confirm & send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
