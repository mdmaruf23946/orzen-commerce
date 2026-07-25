import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Wrench,
  Star,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Info,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listStorePaymentGateways,
  saveStorePaymentGateway,
  testStorePaymentGateway,
  setActiveStorePaymentGateway,
  toggleStorePaymentGateway,
  disconnectStorePaymentGateway,
  testStorePaymentWebhook,
} from "@/lib/store-payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { BrandMark } from "@/components/admin/payments/BrandMark";
import { StatusBadge, type GatewayStatus } from "@/components/admin/payments/StatusBadge";
import { getBrand } from "@/components/admin/payments/providers";
import { WebhookEventsPanel } from "@/components/admin/payments/WebhookEventsPanel";

export const Route = createFileRoute("/_authenticated/admin/payment-gateway")({
  component: PaymentGatewayPage,
});

type Gateway = Awaited<ReturnType<typeof listStorePaymentGateways>>[number];
type CredField = Gateway["credentialFields"][number];

function computeStatus(g: Gateway): GatewayStatus {
  const c = g.connection;
  if (!c) return "none";
  if (!c.enabled) return "disabled";
  if (c.status === "error") return "error";
  const lastOk = (c.last_test_result as any)?.ok === true;
  if (c.status === "connected" && lastOk) return "verified";
  if (c.status === "connected") return "connected";
  return "none";
}

function useStoreId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .maybeSingle();
      if (data) setId(data.id);
    })();
  }, []);
  return id;
}

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
}

function PaymentGatewayPage() {
  const storeId = useStoreId();
  const list = useServerFn(listStorePaymentGateways);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    enabled: !!storeId,
    queryKey: ["storePaymentGateways", storeId],
    queryFn: () => list({ data: { storeId: storeId! } }),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useMemo(() => data?.find((g) => g.provider_id === openId) ?? null, [openId, data]);
  const active = data?.find((g) => g.connection?.is_active) ?? null;
  const activeBrand = active ? getBrand(active.provider_id) : null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["storePaymentGateways", storeId] });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Gateway</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your own merchant account. Customer payments go directly to you.
        </p>
      </header>

      {/* Active gateway hero */}
      <div
        className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
        style={
          activeBrand
            ? { background: `linear-gradient(135deg, ${activeBrand.accentColor}, transparent 70%)` }
            : undefined
        }
      >
        {active && activeBrand ? (
          <div className="flex flex-wrap items-center gap-4">
            <BrandMark brand={activeBrand} size="lg" logoUrl={active.logo_url} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active gateway
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold" style={{ color: activeBrand.brandColor }}>
                  {active.label}
                </span>
                <Badge variant="outline">{active.connection?.sandbox ? "Sandbox" : "Live"}</Badge>
                <StatusBadge status={computeStatus(active)} color={activeBrand.brandColor} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{activeBrand.tagline}</div>
              {active.connection?.last_tested_at && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Last successful sync: {formatWhen(active.connection.last_tested_at)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">No active gateway</div>
              <div className="text-xs text-muted-foreground">
                Online payment is hidden at checkout until you connect and activate a gateway.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards */}
      {isLoading || !storeId ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : data && data.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((g) => (
            <GatewayCard
              key={g.provider_id}
              g={g}
              storeId={storeId}
              onConfigure={() => setOpenId(g.provider_id)}
              onChange={refresh}
            />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed bg-muted/40 p-10 text-center text-sm text-muted-foreground">
          <Sparkles className="mb-2 h-6 w-6" />
          No payment gateways are enabled for your store yet. Please contact support to enable providers.
        </div>
      )}

      {storeId && data && data.length > 0 && (
        <WebhookEventsPanel
          storeId={storeId}
          providers={data.map((g) => ({ provider_id: g.provider_id, label: g.label }))}
        />
      )}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && storeId && (
            <ConfigureForm
              g={open}
              storeId={storeId}
              onDone={() => {
                setOpenId(null);
                refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GatewayCard({
  g,
  storeId,
  onConfigure,
  onChange,
}: {
  g: Gateway;
  storeId: string;
  onConfigure: () => void;
  onChange: () => void;
}) {
  const test = useServerFn(testStorePaymentGateway);
  const setActive = useServerFn(setActiveStorePaymentGateway);
  const toggle = useServerFn(toggleStorePaymentGateway);
  const disconnect = useServerFn(disconnectStorePaymentGateway);
  const [busy, setBusy] = useState<string | null>(null);
  const brand = getBrand(g.provider_id);
  const status = computeStatus(g);
  const c = g.connection;
  const lastResult = c?.last_test_result as any;
  const lastErr = lastResult && !lastResult.ok ? lastResult.message : null;

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      const r: any = await fn();
      if (action === "test") {
        if (r?.ok) toast.success(r.message ?? `${brand.label} connected`);
        else toast.error(r?.message ?? "Test failed");
      } else {
        toast.success("Done");
      }
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="h-1.5" style={{ background: brand.brandColor }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <BrandMark brand={brand} logoUrl={g.logo_url} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold" style={{ color: brand.brandColor }}>
                {g.label}
              </span>
              {c?.is_active && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                  <Star className="mr-1 h-3 w-3 fill-current" /> Default
                </Badge>
              )}
            </div>
            <div className="line-clamp-2 text-[11px] text-muted-foreground">{brand.tagline}</div>
          </div>
          <StatusBadge status={status} color={brand.brandColor} />
        </div>

        <div className="flex flex-wrap gap-1">
          {g.methods.slice(0, 6).map((m) => (
            <Badge key={m} variant="secondary" className="text-[10px] font-normal">
              {m}
            </Badge>
          ))}
        </div>

        {c && (
          <div className="space-y-0.5 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Mode</span>
              <span className="font-medium">{c.sandbox ? "Sandbox" : "Live"}</span>
            </div>
            {c.credentials_preview && (
              <div className="flex items-center justify-between">
                <span>Key</span>
                <span className="font-mono">{c.credentials_preview}</span>
              </div>
            )}
            {c.connected_at && (
              <div className="flex items-center justify-between">
                <span>Connected</span>
                <span>{formatWhen(c.connected_at)}</span>
              </div>
            )}
            {c.last_tested_at && (
              <div className="flex items-center justify-between">
                <span>Last test</span>
                <span>{formatWhen(c.last_tested_at)}</span>
              </div>
            )}
            {lastErr && (
              <div className="mt-1 flex items-start gap-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">
                <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{lastErr}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={c ? "outline" : "default"}
            onClick={onConfigure}
            style={!c ? { background: brand.brandColor, color: "white", borderColor: brand.brandColor } : undefined}
          >
            <Wrench className="mr-1 h-3.5 w-3.5" /> {c ? "Update" : "Connect"}
          </Button>
          {c && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === "test"}
                onClick={() => run("test", () => test({ data: { storeId, providerId: g.provider_id } }))}
              >
                {busy === "test" ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" style={{ color: brand.brandColor }} />
                ) : (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                )}
                Test
              </Button>
              {!c.is_active && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run("active", () => setActive({ data: { storeId, providerId: g.provider_id } }))}
                >
                  <Star className="mr-1 h-3.5 w-3.5" /> Set default
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{c.enabled ? "On" : "Off"}</span>
                <Switch
                  checked={c.enabled}
                  onCheckedChange={(v) =>
                    run("toggle", () =>
                      toggle({ data: { storeId, providerId: g.provider_id, enabled: v } }),
                    )
                  }
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Disconnect ${g.label}?`))
                    run("dis", () => disconnect({ data: { storeId, providerId: g.provider_id } }));
                }}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- ConfigureForm -------------------- */

function CredentialInput({
  field,
  storeId,
  value,
  onChange,
  hasExisting,
  existingPreview,
}: {
  field: CredField;
  storeId: string;
  value: string;
  onChange: (v: string) => void;
  hasExisting: boolean;
  existingPreview?: string | null;
}) {
  const [reveal, setReveal] = useState(false);
  const isSecret = field.type === "password";
  const placeholder = hasExisting
    ? `Leave blank to keep existing${existingPreview ? ` (${existingPreview})` : ""}`
    : field.placeholder;

  const patternRe = field.pattern ? new RegExp(field.pattern) : null;
  const invalid = !!value && patternRe && !patternRe.test(value.trim());

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      onChange(t.trim());
    } catch {
      toast.error("Clipboard not accessible");
    }
  }
  function copyValue() {
    if (!value) return;
    navigator.clipboard.writeText(value).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
  }

  if (field.type === "image") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <ImageUploader
          storeId={storeId}
          folder={`payment-qr/${storeId}`}
          value={value || null}
          onChange={(v) => onChange(v ?? "")}
          label="Upload QR"
        />
        {field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={field.key}>{field.label}</Label>
        <Textarea
          id={field.key}
          rows={4}
          maxLength={1000}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(e.target.value.trim())}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{field.helper}</span>
          <span>{value.length}/1000</span>
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.key}>
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-1">
          {isSecret && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setReveal((r) => !r)}
              title={reveal ? "Hide" : "Show"}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
          {value && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={copyValue}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={pasteFromClipboard}
            title="Paste"
          >
            <span className="text-[10px] font-medium">Paste</span>
          </button>
        </div>
      </div>
      <Input
        id={field.key}
        type={isSecret ? (reveal ? "text" : "password") : field.type === "url" ? "url" : "text"}
        inputMode={field.type === "url" ? "url" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.trim())}
        className={invalid ? "border-destructive focus-visible:ring-destructive" : undefined}
        aria-invalid={invalid ? true : undefined}
      />
      {invalid && field.patternHint && (
        <p className="text-xs text-destructive">{field.patternHint}</p>
      )}
      {!invalid && field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
    </div>
  );
}

function ConfigureForm({
  g,
  storeId,
  onDone,
}: {
  g: Gateway;
  storeId: string;
  onDone: () => void;
}) {
  const save = useServerFn(saveStorePaymentGateway);
  const test = useServerFn(testStorePaymentGateway);
  const testHook = useServerFn(testStorePaymentWebhook);
  const brand = getBrand(g.provider_id);
  const hasExisting = !!g.connection?.has_credentials;

  const [creds, setCreds] = useState<Record<string, string>>(() =>
    Object.fromEntries(g.credentialFields.map((f) => [f.key, ""])),
  );
  const [sandbox, setSandbox] = useState(g.connection?.sandbox ?? true);
  const [enabled, setEnabled] = useState(g.connection?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Group fields by `group` (preserve first-seen order)
  const groups = useMemo(() => {
    const seen: string[] = [];
    const map = new Map<string, CredField[]>();
    for (const f of g.credentialFields) {
      const gr = f.group ?? "Credentials";
      if (!map.has(gr)) {
        map.set(gr, []);
        seen.push(gr);
      }
      map.get(gr)!.push(f);
    }
    return seen.map((k) => ({ name: k, fields: map.get(k)! }));
  }, [g.credentialFields]);

  const missingRequired = g.credentialFields
    .filter((f) => f.required && !hasExisting)
    .some((f) => !creds[f.key]?.trim());

  const invalidFormat = g.credentialFields.some((f) => {
    if (!f.pattern) return false;
    const v = creds[f.key];
    if (!v) return false;
    try {
      return !new RegExp(f.pattern).test(v.trim());
    } catch {
      return false;
    }
  });

  const saveDisabled = saving || missingRequired || invalidFormat;

  async function submit(alsoSetDefault = false) {
    setSaving(true);
    setTestResult(null);
    try {
      const res: any = await save({
        data: { storeId, providerId: g.provider_id, credentials: creds, sandbox, enabled },
      });
      if (res?.ok) {
        toast.success(res.message ?? `${brand.label} connected`);
        if (alsoSetDefault) {
          const { setActiveStorePaymentGateway } = await import("@/lib/store-payments.functions");
          try {
            const setActive = setActiveStorePaymentGateway as any;
            await setActive({ data: { storeId, providerId: g.provider_id } });
          } catch {
            /* noop — surface silently, save still succeeded */
          }
        }
        onDone();
      } else {
        setTestResult({ ok: false, message: res?.error ?? "Invalid credentials" });
        toast.error(res?.error ?? "Invalid credentials");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!hasExisting) {
      toast.info("Save the gateway first to run a live test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await test({ data: { storeId, providerId: g.provider_id } });
      setTestResult({ ok: !!r?.ok, message: r?.message ?? (r?.ok ? "Connected" : "Failed") });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message ?? "Failed" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b pb-4">
        <div className="flex items-center gap-3">
          <BrandMark brand={brand} logoUrl={g.logo_url} size="lg" />
          <div className="min-w-0">
            <SheetTitle style={{ color: brand.brandColor }}>{brand.label}</SheetTitle>
            <SheetDescription className="mt-0.5">{brand.tagline}</SheetDescription>
            {brand.docsUrl && (
              <a
                href={brand.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Read docs <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="my-4 space-y-4">
        {hasExisting && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Existing credentials are encrypted and hidden. Leave a field blank to keep its current value; type a new
              value to overwrite it.
            </span>
          </div>
        )}

        <Accordion type="multiple" defaultValue={groups.map((g) => g.name)} className="w-full">
          {groups.map((section) => (
            <AccordionItem key={section.name} value={section.name}>
              <AccordionTrigger className="text-sm font-semibold">{section.name}</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {section.fields.map((f) => (
                  <CredentialInput
                    key={f.key}
                    field={f}
                    storeId={storeId}
                    value={creds[f.key] ?? ""}
                    onChange={(v) => setCreds((prev) => ({ ...prev, [f.key]: v }))}
                    hasExisting={hasExisting}
                    existingPreview={g.connection?.credentials_preview ?? null}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="space-y-3 rounded-md border p-3">
          {g.supportsSandbox && (
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sb" className="cursor-pointer">
                  Sandbox mode
                </Label>
                <p className="text-xs text-muted-foreground">Test transactions without real money.</p>
              </div>
              <Switch id="sb" checked={sandbox} onCheckedChange={setSandbox} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="en" className="cursor-pointer">
                Enabled
              </Label>
              <p className="text-xs text-muted-foreground">Disable to hide from checkout without deleting.</p>
            </div>
            <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              testResult.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      <SheetFooter className="sticky bottom-0 -mx-6 flex-col gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur sm:flex-col">
        <div className="flex w-full flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={runTest}
            disabled={testing || !hasExisting}
            title={!hasExisting ? "Save first to enable live test" : undefined}
          >
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Test Connection
          </Button>
          <Button
            className="flex-1"
            onClick={() => submit(false)}
            disabled={saveDisabled}
            style={{ background: brand.brandColor, color: "white" }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => submit(true)}
          disabled={saveDisabled}
        >
          <Star className="mr-2 h-4 w-4" /> Save & set as default
        </Button>
        {missingRequired && (
          <p className="w-full text-center text-xs text-destructive">Fill all required fields to continue.</p>
        )}
        {invalidFormat && !missingRequired && (
          <p className="w-full text-center text-xs text-destructive">One or more fields have an invalid format.</p>
        )}
      </SheetFooter>
    </>
  );
}
