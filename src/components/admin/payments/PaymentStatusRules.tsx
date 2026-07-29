import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { getPaymentStatusRules, updatePaymentStatusRules } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
type Rules = {
  online_pending: Status;
  online_paid: Status;
  manual: Status;
  cod: Status;
};

const STATUSES: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const FIELDS: { key: keyof Rules; label: string; hint: string }[] = [
  {
    key: "online_pending",
    label: "Online payment started",
    hint: "Status right after the shopper is sent to the payment gateway.",
  },
  {
    key: "online_paid",
    label: "Online payment successful",
    hint: "Status applied when the gateway confirms the payment.",
  },
  {
    key: "manual",
    label: "Manual payment (bKash / Nagad / bank)",
    hint: "Status for orders paid manually with a transaction ID.",
  },
  { key: "cod", label: "Cash on Delivery", hint: "Status for COD orders." },
];

export function PaymentStatusRules() {
  const load = useServerFn(getPaymentStatusRules);
  const save = useServerFn(updatePaymentStatusRules);
  const { data } = useQuery({ queryKey: ["paymentStatusRules"], queryFn: () => load() });
  const [rules, setRules] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setRules(data as Rules);
  }, [data]);

  const current = rules;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
          <Settings2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Order status rules</h2>
          <p className="text-xs text-muted-foreground">
            Choose which status an order gets after each type of payment.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Select
              value={current?.[f.key] ?? "pending"}
              onValueChange={(v) =>
                setRules((r) => ({ ...(r ?? ({} as Rules)), [f.key]: v as Status }) as Rules)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button
          size="sm"
          disabled={saving || !current}
          onClick={async () => {
            if (!current) return;
            setSaving(true);
            try {
              await save({ data: current });
              toast.success("Order status rules saved");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </section>
  );
}
