import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Save, Zap, MapPin, Truck, Activity, RefreshCw, Unplug, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrandBadge, StatusChip, VerifiedBadge } from "./BrandBadge";
import {
  emptyConfig,
  DEFAULT_CREDENTIAL_FIELDS,
  readCredential,
  type CourierConfig,
  type CourierMeta,
  type CredentialFieldSpec,
} from "./providers";

export type SimpleCourierCardProps = {
  meta: CourierMeta;
  value: CourierConfig;
  onChange: (next: CourierConfig) => void;
  onSave: () => Promise<void> | void;
  onTest: () => Promise<void> | void;
  onSync?: () => Promise<void> | void;
  onDisconnect?: () => Promise<void> | void;
  onSetDefault: () => void;
  saving?: boolean;
  testing?: boolean;
  syncing?: boolean;
  logoUrl?: string | null;
  wordmarkUrl?: string | null;
};

const PHONE_RE = /^01[3-9]\d{8}$/;

/**
 * Beginner-friendly courier form matching each courier's official API spec.
 * Sections: Credentials → Pickup → Shipping → Actions → Diagnostics.
 */
export function SimpleCourierCard({
  meta,
  value,
  onChange,
  onSave,
  onTest,
  onSync,
  onDisconnect,
  onSetDefault,
  saving,
  testing,
  syncing,
  logoUrl,
  wordmarkUrl,
}: SimpleCourierCardProps) {
  const cfg = { ...emptyConfig, ...value } as CourierConfig;
  const fields: CredentialFieldSpec[] = meta.credentialFields ?? DEFAULT_CREDENTIAL_FIELDS;
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (patch: Partial<CourierConfig>) => onChange({ ...cfg, ...patch });
  const setShipping = (patch: Partial<NonNullable<CourierConfig["shipping"]>>) =>
    set({ shipping: { ...(cfg.shipping ?? {}), ...patch } });
  const setPickup = (patch: Partial<NonNullable<CourierConfig["pickup"]>>) =>
    set({ pickup: { ...(cfg.pickup ?? {}), ...patch } });
  const setCred = (key: string, v: string) => {
    setErrors((e) => ({ ...e, [key]: "" }));
    set({ credentials: { ...(cfg.credentials ?? {}), [key]: v } });
  };

  const status = cfg.diagnostics?.lastStatus ?? "unknown";

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (cfg.enabled) {
      for (const f of fields) {
        const v = readCredential(cfg, f.key).trim();
        if (f.required && !v) next[f.key] = `${f.label} is required`;
        if (f.type === "url" && v && !/^https:\/\/\S+$/i.test(v))
          next[f.key] = "Must be a valid https:// URL";
      }
      const phone = (cfg.pickup?.phone ?? "").trim();
      if (phone && !PHONE_RE.test(phone)) next["pickup_phone"] = "Use a valid BD number (01XXXXXXXXX)";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(`${meta.label}: ${Object.values(next)[0]}`);
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      await onSave();
      toast.success(`${meta.label} configuration saved`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleTest() {
    if (!validate()) return;
    try {
      await onTest();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSync() {
    if (!onSync) return;
    if (!validate()) return;
    try {
      await onSync();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDisconnect() {
    if (!onDisconnect) return;
    if (!window.confirm(`Disconnect ${meta.label}? Saved credentials will be cleared.`)) return;
    try {
      await onDisconnect();
      toast.success(`${meta.label} disconnected`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ borderTop: `3px solid ${meta.brandColor}` }}
    >
      <div className="flex flex-wrap items-start gap-3 border-b p-4">
        <BrandBadge meta={meta} logoUrl={logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {wordmarkUrl ? (
              <img
                src={wordmarkUrl.startsWith("http") ? wordmarkUrl : `/api/img/${wordmarkUrl}`}
                alt={meta.label}
                loading="lazy"
                decoding="async"
                className="h-6 max-w-[180px] object-contain dark:brightness-0 dark:invert"
              />
            ) : (
              <h3 className="truncate text-base font-semibold">{meta.label}</h3>
            )}
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
            {cfg.sandbox && meta.supports.sandbox && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                Sandbox
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.tagline}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Enabled
          <Switch checked={!!cfg.enabled} onCheckedChange={(v) => set({ enabled: v })} />
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
              {fields.map((f) => {
                const isSecret = f.type === "password";
                const isShown = !!shown[f.key];
                const val = readCredential(cfg, f.key);
                const full = f.type === "url";
                const err = errors[f.key];
                return (
                  <div key={f.key} className={full ? "sm:col-span-2" : undefined}>
                    <Field label={f.label + (f.required ? " *" : "")}>
                      <div className="flex gap-2">
                        <Input
                          type={isSecret ? (isShown ? "text" : "password") : "text"}
                          placeholder={f.placeholder ?? f.defaultValue}
                          value={val}
                          aria-invalid={!!err}
                          className={err ? "border-destructive" : undefined}
                          onChange={(e) => setCred(f.key, e.target.value)}
                        />
                        {isSecret && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShown((s) => ({ ...s, [f.key]: !s[f.key] }))}
                          >
                            {isShown ? "Hide" : "Show"}
                          </Button>
                        )}
                        {f.type === "url" && f.defaultValue && !val && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCred(f.key, f.defaultValue!)}
                          >
                            Use default
                          </Button>
                        )}
                      </div>
                      {err ? (
                        <p className="mt-1 text-[11px] text-destructive">{err}</p>
                      ) : (
                        f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>
                      )}
                    </Field>
                  </div>
                );
              })}
              {meta.supports.sandbox && (
                <Toggle
                  label="Sandbox mode"
                  checked={!!cfg.sandbox}
                  onChange={(v) => set({ sandbox: v })}
                />
              )}
              <Toggle
                label="Set as default"
                checked={!!cfg.is_default}
                onChange={(v) => (v ? onSetDefault() : set({ is_default: false }))}
              />
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
              <Field label="Pickup name">
                <Input
                  value={cfg.pickup?.contactName ?? ""}
                  onChange={(e) => setPickup({ contactName: e.target.value })}
                />
              </Field>
              <Field label="Pickup phone">
                <Input
                  inputMode="numeric"
                  placeholder="01XXXXXXXXX"
                  value={cfg.pickup?.phone ?? ""}
                  aria-invalid={!!errors["pickup_phone"]}
                  className={errors["pickup_phone"] ? "border-destructive" : undefined}
                  onChange={(e) => {
                    setErrors((x) => ({ ...x, pickup_phone: "" }));
                    setPickup({ phone: e.target.value });
                  }}
                />
                {errors["pickup_phone"] && (
                  <p className="mt-1 text-[11px] text-destructive">{errors["pickup_phone"]}</p>
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Pickup address">
                  <Input
                    value={cfg.pickup?.address ?? ""}
                    onChange={(e) => setPickup({ address: e.target.value })}
                  />
                </Field>
              </div>
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="diag">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: meta.brandColor }} />
              Diagnostics
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-4 text-sm">
            <Row label="Connection status">
              <StatusChip status={status} />
            </Row>
            <Row label="Last connection">
              <span className="text-muted-foreground">
                {cfg.diagnostics?.lastConnectedAt
                  ? new Date(cfg.diagnostics.lastConnectedAt).toLocaleString()
                  : "—"}
              </span>
            </Row>
            {meta.supports.sync && (
              <Row label="Last sync">
                <span className="text-muted-foreground">
                  {cfg.diagnostics?.lastSyncAt
                    ? `${new Date(cfg.diagnostics.lastSyncAt).toLocaleString()}${
                        cfg.diagnostics.lastSyncSummary ? ` · ${cfg.diagnostics.lastSyncSummary}` : ""
                      }`
                    : "—"}
                </span>
              </Row>
            )}
            {status === "error" && cfg.diagnostics?.lastError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[12px] text-destructive">
                {cfg.diagnostics.lastError}
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-wrap gap-2 border-t p-4">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save configuration"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {meta.supports.sync && onSync && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync courier info"}
          </Button>
        )}
        {cfg.enabled && status === "connected" && (
          <Button size="sm" variant="secondary" asChild>
            <Link to="/admin/parcels" search={{ courier: meta.key }}>
              <Package className="mr-1 h-3.5 w-3.5" />
              Manage Parcels
            </Link>
          </Button>
        )}
        {onDisconnect && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDisconnect}>
            <Unplug className="mr-1 h-3.5 w-3.5" />
            Disconnect
          </Button>
        )}
      </div>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
