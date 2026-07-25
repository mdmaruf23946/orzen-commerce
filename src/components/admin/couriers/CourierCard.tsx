import { useState } from "react";
import { toast } from "sonner";
import { Save, Zap, MapPin, Truck, Settings2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrandBadge, StatusChip, VerifiedBadge } from "./BrandBadge";
import { CourierDiagnosticsPanel } from "./CourierDiagnostics";
import {
  emptyConfig,
  type CourierConfig,
  type CourierMeta,
} from "./providers";

type Props = {
  meta: CourierMeta;
  value: CourierConfig;
  onChange: (next: CourierConfig) => void;
  onSave: () => Promise<void> | void;
  onTest: () => Promise<void> | void;
  onSetDefault: () => void;
  saving?: boolean;
  testing?: boolean;
  logoUrl?: string | null;
};

export function CourierCard({
  meta,
  value,
  onChange,
  onSave,
  onTest,
  onSetDefault,
  saving,
  testing,
  logoUrl,
}: Props) {

  const cfg = { ...emptyConfig, ...value } as CourierConfig;
  const set = (patch: Partial<CourierConfig>) => onChange({ ...cfg, ...patch });
  const setShipping = (patch: Partial<NonNullable<CourierConfig["shipping"]>>) =>
    set({ shipping: { ...(cfg.shipping ?? {}), ...patch } });
  const setPickup = (patch: Partial<NonNullable<CourierConfig["pickup"]>>) =>
    set({ pickup: { ...(cfg.pickup ?? {}), ...patch } });
  const setAuto = (patch: Partial<NonNullable<CourierConfig["automation"]>>) =>
    set({ automation: { ...(cfg.automation ?? {}), ...patch } });

  const [showApi, setShowApi] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const status = cfg.diagnostics?.lastStatus ?? "unknown";

  async function handleTest() {
    try {
      await onTest();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function handleSave() {
    try {
      await onSave();
      toast.success(`${meta.label} saved`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const s = meta.supports;

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ borderTop: `3px solid ${meta.brandColor}` }}
    >
      <div className="flex flex-wrap items-start gap-3 border-b p-4">
        <BrandBadge meta={meta} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{meta.label}</h3>
            <VerifiedBadge color={meta.brandColor} />
            <StatusChip status={status} />
            {cfg.is_default && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: meta.brandColorSoft, color: meta.brandColor }}
              >
                Default
              </span>
            )}
            {cfg.sandbox && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                Sandbox
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.tagline}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Enabled
          <Switch
            checked={!!cfg.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
        </label>
      </div>

      <Accordion type="multiple" defaultValue={["cred"]} className="px-4">
        <AccordionItem value="cred">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: meta.brandColor }} />
              Credentials
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="API Key">
                <div className="flex gap-2">
                  <Input
                    type={showApi ? "text" : "password"}
                    value={cfg.api_key ?? ""}
                    onChange={(e) => set({ api_key: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowApi((v) => !v)}
                  >
                    {showApi ? "Hide" : "Show"}
                  </Button>
                </div>
              </Field>
              <Field label="Secret Key">
                <div className="flex gap-2">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={cfg.secret ?? ""}
                    onChange={(e) => set({ secret: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSecret((v) => !v)}
                  >
                    {showSecret ? "Hide" : "Show"}
                  </Button>
                </div>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Base URL">
                  <Input
                    placeholder="https://"
                    value={cfg.base_url ?? ""}
                    onChange={(e) => set({ base_url: e.target.value })}
                  />
                </Field>
              </div>
              {s.sandbox && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!cfg.sandbox}
                    onCheckedChange={(v) => set({ sandbox: v })}
                  />
                  Sandbox mode
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!!cfg.is_default}
                  onCheckedChange={(v) => (v ? onSetDefault() : set({ is_default: false }))}
                />
                Set as default
              </label>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save configuration"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              {cfg.diagnostics?.lastConnectedAt && (
                <span className="ml-auto self-center text-xs text-muted-foreground">
                  Last: {new Date(cfg.diagnostics.lastConnectedAt).toLocaleString()}
                </span>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ship">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" style={{ color: meta.brandColor }} />
              Shipping options
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Inside city charge">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cfg.shipping?.insideCity ?? ""}
                  onChange={(e) =>
                    setShipping({ insideCity: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Outside city charge">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cfg.shipping?.outsideCity ?? ""}
                  onChange={(e) =>
                    setShipping({ outsideCity: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </Field>
              {s.subCity && (
                <Field label="Sub-city / metro charge">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={cfg.shipping?.subCity ?? ""}
                    onChange={(e) =>
                      setShipping({ subCity: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </Field>
              )}
              <Field label="Delivery priority">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0 = highest"
                  value={cfg.shipping?.priority ?? ""}
                  onChange={(e) =>
                    setShipping({ priority: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle
                label="Cash on delivery"
                checked={!!cfg.shipping?.cod}
                onChange={(v) => setShipping({ cod: v })}
              />
              <Toggle
                label="Home delivery"
                checked={!!cfg.shipping?.home}
                onChange={(v) => setShipping({ home: v })}
              />
              {s.pickupPoint && (
                <Toggle
                  label="Pickup point delivery"
                  checked={!!cfg.shipping?.pickupPoint}
                  onChange={(v) => setShipping({ pickupPoint: v })}
                />
              )}
              {s.returnDelivery && (
                <Toggle
                  label="Return delivery"
                  checked={!!cfg.shipping?.returnDelivery}
                  onChange={(v) => setShipping({ returnDelivery: v })}
                />
              )}
              {s.exchange && (
                <Toggle
                  label="Exchange delivery"
                  checked={!!cfg.shipping?.exchange}
                  onChange={(v) => setShipping({ exchange: v })}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pickup">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: meta.brandColor }} />
              Pickup information
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact name">
                <Input
                  value={cfg.pickup?.contactName ?? ""}
                  onChange={(e) => setPickup({ contactName: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={cfg.pickup?.phone ?? ""}
                  onChange={(e) => setPickup({ phone: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Pickup address">
                  <Input
                    value={cfg.pickup?.address ?? ""}
                    onChange={(e) => setPickup({ address: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="District">
                <Input
                  value={cfg.pickup?.district ?? ""}
                  onChange={(e) => setPickup({ district: e.target.value })}
                />
              </Field>
              <Field label="Area / Thana">
                <Input
                  value={cfg.pickup?.area ?? ""}
                  onChange={(e) => setPickup({ area: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Pickup instructions">
                  <Textarea
                    rows={2}
                    value={cfg.pickup?.instructions ?? ""}
                    onChange={(e) => setPickup({ instructions: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {(s.autoParcel ||
          s.autoStatus ||
          s.autoTracking ||
          s.autoLabel ||
          s.autoSms ||
          s.autoNotify) && (
          <AccordionItem value="auto">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" style={{ color: meta.brandColor }} />
                Advanced automation
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {s.autoParcel && (
                  <Toggle
                    label="Auto create parcel"
                    checked={!!cfg.automation?.autoParcel}
                    onChange={(v) => setAuto({ autoParcel: v })}
                  />
                )}
                {s.autoStatus && (
                  <Toggle
                    label="Auto update delivery status"
                    checked={!!cfg.automation?.autoStatus}
                    onChange={(v) => setAuto({ autoStatus: v })}
                  />
                )}
                {s.autoTracking && (
                  <Toggle
                    label="Auto sync tracking"
                    checked={!!cfg.automation?.autoTracking}
                    onChange={(v) => setAuto({ autoTracking: v })}
                  />
                )}
                {s.autoLabel && (
                  <Toggle
                    label="Auto print label"
                    checked={!!cfg.automation?.autoLabel}
                    onChange={(v) => setAuto({ autoLabel: v })}
                  />
                )}
                {s.autoSms && (
                  <Toggle
                    label="Auto send SMS"
                    checked={!!cfg.automation?.autoSms}
                    onChange={(v) => setAuto({ autoSms: v })}
                  />
                )}
                {s.autoNotify && (
                  <Toggle
                    label="Auto customer notification"
                    checked={!!cfg.automation?.autoNotify}
                    onChange={(v) => setAuto({ autoNotify: v })}
                  />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="diag">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: meta.brandColor }} />
              Diagnostics
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <CourierDiagnosticsPanel
              diagnostics={cfg.diagnostics}
              onRetry={handleTest}
              busy={testing}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
