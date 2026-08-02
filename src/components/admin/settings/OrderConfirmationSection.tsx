// Store Admin → Settings → Order Confirmation.
// Controls whether digital / service / subscription orders confirm
// automatically after payment or wait for manual approval.
// Physical orders are intentionally absent — their workflow is unchanged.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getOrderConfirmationSettings,
  setOrderConfirmationSettings,
} from "@/lib/orders-types.functions";

type Mode = "auto" | "manual";
type Form = { digital: Mode; service: Mode; subscription: Mode };

const ROWS: { key: keyof Form; label: string; hint: string }[] = [
  { key: "digital", label: "Digital orders", hint: "Auto grants download access and emails files right after payment." },
  { key: "service", label: "Service orders", hint: "Manual lets you check availability before booking is confirmed." },
  { key: "subscription", label: "Subscription orders", hint: "Manual lets you verify before the plan is activated." },
];

export function OrderConfirmationSection() {
  const get = useServerFn(getOrderConfirmationSettings);
  const put = useServerFn(setOrderConfirmationSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "order-confirmation"], queryFn: () => get() });
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data as Form);
  }, [data]);

  async function submit() {
    if (!form) return;
    setSaving(true);
    try {
      await put({ data: form });
      qc.invalidateQueries({ queryKey: ["admin", "order-confirmation"] });
      toast.success("Confirmation settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CheckCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Order Confirmation Settings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose how non-physical orders get confirmed after payment. Physical orders keep their existing workflow.
          </p>
        </div>
      </div>

      {!form ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {ROWS.map((r) => (
            <div
              key={r.key}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.label}</div>
                <p className="text-[11px] text-muted-foreground">{r.hint}</p>
              </div>
              <div className="flex shrink-0 gap-1 rounded-lg border p-0.5">
                {(["auto", "manual"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...(f as Form), [r.key]: m }))}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-150 ${
                      form[r.key] === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {m === "auto" ? "Automatic" : "Manual"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "Save confirmation settings"}
          </Button>
        </div>
      )}
    </section>
  );
}
