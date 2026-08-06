// Step 2 — essentials, dynamic per product type.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DigitalFilesUploader } from "../DigitalFilesUploader";
import { Field, Grid, NumField, Section, SelectField, TextField, ToggleField } from "./ui";
import {
  PLAN_KEYS,
  PLAN_LABEL,
  type AiEssentials,
  type AiProductType,
  type PlanKey,
} from "./types";

type Props = {
  storeId: string;
  productType: AiProductType;
  ess: AiEssentials;
  set: <K extends keyof AiEssentials>(key: K, value: AiEssentials[K]) => void;
};

export function StepEssentials({ storeId, productType, ess, set }: Props) {
  if (productType === "digital") return <DigitalEssentials storeId={storeId} ess={ess} set={set} />;
  if (productType === "service") return <ServiceEssentials ess={ess} set={set} />;
  if (productType === "subscription") return <SubscriptionEssentials ess={ess} set={set} />;
  return <PhysicalEssentials ess={ess} set={set} />;
}

function Intro({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function PriceBlock({ ess, set, label = "Selling price" }: { ess: AiEssentials; set: Props["set"]; label?: string }) {
  const priceNum = Number(ess.price);
  const oldNum = Number(ess.oldPrice);
  const off = priceNum > 0 && oldNum > priceNum ? Math.round(((oldNum - priceNum) / oldNum) * 100) : 0;
  return (
    <Section title="Pricing (BDT)">
      <Grid cols={2}>
        <NumField label={label} required value={ess.price} onChange={(v) => set("price", v)} placeholder="e.g. 499" />
        <NumField label="Compare price" value={ess.oldPrice} onChange={(v) => set("oldPrice", v)} placeholder="e.g. 699" />
      </Grid>
      {off > 0 && <p className="mt-2 text-xs text-emerald-600">Discount: {off}% off</p>}
    </Section>
  );
}

// ---------------------------------------------------------------- physical
function PhysicalEssentials({ ess, set }: { ess: AiEssentials; set: Props["set"] }) {
  return (
    <div className="space-y-4">
      <Intro text="Pricing, stock and shipping facts the AI cannot guess. Everything you fill here is used as-is." />
      <Section title="Pricing (BDT)">
        <Grid cols={3}>
          <NumField label="Selling price" required value={ess.price} onChange={(v) => set("price", v)} placeholder="e.g. 499" />
          <NumField label="Compare price" value={ess.oldPrice} onChange={(v) => set("oldPrice", v)} placeholder="e.g. 699" />
          <NumField label="Cost price" hint="profit calc" value={ess.costPrice} onChange={(v) => set("costPrice", v)} placeholder="e.g. 300" />
        </Grid>
      </Section>

      <Section title="Inventory">
        <Grid cols={3}>
          <NumField label="Stock quantity" value={ess.stock} onChange={(v) => set("stock", v)} placeholder="e.g. 50" />
          <TextField label="SKU / Product code" value={ess.sku} onChange={(v) => set("sku", v)} placeholder="e.g. SHRT-001" />
          <NumField label="Low stock alert at" value={ess.lowStock} onChange={(v) => set("lowStock", v)} placeholder="e.g. 5" />
        </Grid>
      </Section>

      <Section title="Shipping">
        <Grid cols={2}>
          <NumField label="Weight (grams)" value={ess.weight} onChange={(v) => set("weight", v)} placeholder="e.g. 250" />
          <Field label="Dimensions (cm)" hint="L × W × H">
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" min={0} placeholder="L" value={ess.dimL} onChange={(e) => set("dimL", e.target.value)} />
              <Input type="number" min={0} placeholder="W" value={ess.dimW} onChange={(e) => set("dimW", e.target.value)} />
              <Input type="number" min={0} placeholder="H" value={ess.dimH} onChange={(e) => set("dimH", e.target.value)} />
            </div>
          </Field>
        </Grid>
      </Section>

      <Section title="Product facts">
        <Grid cols={3}>
          <TextField label="Warranty" value={ess.warranty} onChange={(v) => set("warranty", v)} placeholder="e.g. 1 year" />
          <TextField label="Manufacturer" value={ess.manufacturer} onChange={(v) => set("manufacturer", v)} placeholder="e.g. Walton" />
          <TextField label="Country of origin" value={ess.origin} onChange={(v) => set("origin", v)} placeholder="e.g. Bangladesh" />
        </Grid>
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------- digital
function DigitalEssentials({ storeId, ess, set }: { storeId: string; ess: AiEssentials; set: Props["set"] }) {
  return (
    <div className="space-y-4">
      <Intro text="Pricing and delivery rules for your downloadable item. No stock or shipping needed." />
      <PriceBlock ess={ess} set={set} />

      <Section title="Delivery">
        <Grid cols={2}>
          <SelectField
            label="Delivery type"
            value={ess.deliveryType}
            onChange={(v) => set("deliveryType", v)}
            options={[
              { value: "instant", label: "Instant download" },
              { value: "manual", label: "Manual delivery" },
              { value: "external", label: "External link" },
            ]}
          />
          <TextField label="File version" value={ess.fileVersion} onChange={(v) => set("fileVersion", v)} placeholder="e.g. 1.0.2" />
        </Grid>

        <div className="mt-3 space-y-2">
          {ess.deliveryType === "external" ? (
            <Field label="External URL" required>
              <Input
                type="url"
                placeholder="https://…"
                value={ess.externalUrl}
                onChange={(e) => set("externalUrl", e.target.value)}
              />
            </Field>
          ) : (
            <>
              <Label className="text-xs">Product files</Label>
              <DigitalFilesUploader storeId={storeId} value={ess.files} onChange={(f) => set("files", f)} />
            </>
          )}
        </div>
      </Section>

      <Section title="Access rules">
        <Grid cols={3}>
          <NumField label="Download limit" hint="blank = unlimited" value={ess.downloadLimit} onChange={(v) => set("downloadLimit", v)} placeholder="e.g. 5" />
          <NumField label="Expiry days" hint="blank = never" value={ess.expiryDays} onChange={(v) => set("expiryDays", v)} placeholder="e.g. 30" />
          <SelectField
            label="License type"
            value={ess.licenseType}
            onChange={(v) => set("licenseType", v)}
            options={[
              { value: "personal", label: "Personal" },
              { value: "commercial", label: "Commercial" },
              { value: "extended", label: "Extended" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </Grid>
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------- service
function ServiceEssentials({ ess, set }: { ess: AiEssentials; set: Props["set"] }) {
  return (
    <div className="space-y-4">
      <Intro text="How the service is priced and booked. No stock, shipping or variants." />
      <Section title="Pricing (BDT)">
        <Grid cols={3}>
          <SelectField
            label="Pricing mode"
            value={ess.pricingMode}
            onChange={(v) => set("pricingMode", v)}
            options={[
              { value: "fixed", label: "Fixed price" },
              { value: "starting", label: "Starting from" },
            ]}
          />
          <NumField label={ess.pricingMode === "starting" ? "Starting price" : "Fixed price"} required value={ess.price} onChange={(v) => set("price", v)} placeholder="e.g. 5000" />
          <NumField label="Compare price" value={ess.oldPrice} onChange={(v) => set("oldPrice", v)} placeholder="e.g. 7000" />
        </Grid>
      </Section>

      <Section title="Booking">
        <div className="space-y-3">
          <ToggleField label="Booking required" value={ess.bookingRequired} onChange={(v) => set("bookingRequired", v)} hint="customer picks a slot" />
          <Grid cols={2}>
            <NumField label="Appointment duration (minutes)" value={ess.appointmentMinutes} onChange={(v) => set("appointmentMinutes", v)} placeholder="e.g. 60" />
            <SelectField
              label="Service mode"
              value={ess.serviceMode}
              onChange={(v) => set("serviceMode", v)}
              options={[
                { value: "online", label: "Online" },
                { value: "offline", label: "Offline / on-site" },
                { value: "both", label: "Online & offline" },
              ]}
            />
          </Grid>
        </div>
      </Section>

      <Section title="Delivery & support">
        <Grid cols={3}>
          <TextField label="Service area" value={ess.serviceArea} onChange={(v) => set("serviceArea", v)} placeholder="e.g. Dhaka, nationwide" />
          <TextField label="Delivery time" value={ess.deliveryTime} onChange={(v) => set("deliveryTime", v)} placeholder="e.g. 3 days" />
          <TextField label="Response time" value={ess.responseTime} onChange={(v) => set("responseTime", v)} placeholder="e.g. within 2 hours" />
        </Grid>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------ subscription
function SubscriptionEssentials({ ess, set }: { ess: AiEssentials; set: Props["set"] }) {
  function updatePlan(k: PlanKey, patch: Partial<{ enabled: boolean; price: string; compare: string }>) {
    set("plans", { ...ess.plans, [k]: { ...ess.plans[k], ...patch } });
  }
  return (
    <div className="space-y-4">
      <Intro text="Enable the billing plans you sell and price each one. Customers choose a plan at checkout." />

      <Section title="Billing plans" hint="At least one plan with a price is required.">
        <div className="space-y-2">
          {PLAN_KEYS.map((k) => {
            const row = ess.plans[k];
            return (
              <div key={k} className={`rounded-lg border p-3 ${row.enabled ? "bg-background" : "bg-muted/40"}`}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={row.enabled}
                    onChange={(e) => updatePlan(k, { enabled: e.target.checked })}
                  />
                  <span className="text-sm font-medium">{PLAN_LABEL[k]}</span>
                </label>
                {row.enabled && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <NumField label="Price" required value={row.price} onChange={(v) => updatePlan(k, { price: v })} placeholder="e.g. 499" />
                    <NumField label="Compare price" value={row.compare} onChange={(v) => updatePlan(k, { compare: v })} placeholder="e.g. 699" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Trial">
        <div className="space-y-3">
          <ToggleField label="Enable free trial" value={ess.trialEnabled} onChange={(v) => set("trialEnabled", v)} />
          {ess.trialEnabled && (
            <NumField label="Trial days" value={ess.trialDays} onChange={(v) => set("trialDays", v)} placeholder="e.g. 7" />
          )}
        </div>
      </Section>

      <Section title="Activation & renewal">
        <Grid cols={2}>
          <SelectField
            label="Activation"
            value={ess.activation}
            onChange={(v) => set("activation", v)}
            options={[
              { value: "automatic", label: "Automatic" },
              { value: "manual", label: "Manual approval" },
            ]}
          />
          <SelectField
            label="Renewal"
            value={ess.renewal}
            onChange={(v) => set("renewal", v)}
            options={[
              { value: "automatic", label: "Auto renewal" },
              { value: "manual", label: "Manual renewal" },
            ]}
          />
        </Grid>
      </Section>
    </div>
  );
}
