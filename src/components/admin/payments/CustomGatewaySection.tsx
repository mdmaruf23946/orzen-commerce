// UI for the Custom Payment Gateway Builder.
// Renders a section on the Payment Gateway page listing store-defined custom
// gateways plus a "+ Add Custom Gateway" card. The Sheet-based editor is
// organised into the 10 sections from the spec (basic info, auth, endpoint,
// request mapping, response mapping, webhook, verification, refunds, methods,
// review). Secrets are only ever sent to the server on save/test.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  TestTube,
  Trash2,
  Wand2,
  Webhook,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  listCustomGateways,
  saveCustomGateway,
  deleteCustomGateway,
  setCustomGatewayEnabled,
  testCustomGateway,
  listCustomGatewayEvents,
} from "@/lib/custom-gateway/gateways.functions";
import {
  AUTH_TYPES,
  CustomGatewayConfigSchema,
  InternalVariables,
  type CustomGatewayPublic,
} from "@/lib/custom-gateway/types";

type Gateway = CustomGatewayPublic;

const EMPTY_CONFIG = CustomGatewayConfigSchema.parse({
  request: {},
  checkout: {},
  response: {},
  webhook: {
    signature: {},
  },
  verification: {},
  refund: {},
});

const DEFAULT_FORM: EditorState = {
  name: "",
  slug: "",
  logo_url: "",
  description: "",
  website_url: "",
  docs_url: "",
  support_email: "",
  currency: "BDT",
  currencies: ["BDT"],
  environment: "sandbox",
  auth_type: "api_key",
  api_base_url: "",
  sandbox_base_url: "",
  config: EMPTY_CONFIG,
  credentials: {},
};

type EditorState = {
  name: string;
  slug: string;
  logo_url: string;
  description: string;
  website_url: string;
  docs_url: string;
  support_email: string;
  currency: string;
  currencies: string[];
  environment: "sandbox" | "production";
  auth_type: (typeof AUTH_TYPES)[number];
  api_base_url: string;
  sandbox_base_url: string;
  config: typeof EMPTY_CONFIG;
  credentials: Record<string, string>;
};

function seedFromGateway(g: Gateway): EditorState {
  return {
    name: g.name,
    slug: g.slug,
    logo_url: g.logo_url ?? "",
    description: g.description ?? "",
    website_url: g.website_url ?? "",
    docs_url: g.docs_url ?? "",
    support_email: g.support_email ?? "",
    currency: g.currency,
    currencies: g.currencies?.length ? g.currencies : [g.currency],
    environment: g.environment,
    auth_type: g.auth_type,
    api_base_url: g.api_base_url ?? "",
    sandbox_base_url: g.sandbox_base_url ?? "",
    config: {
      ...EMPTY_CONFIG,
      ...(g.config as any),
      webhook: { ...EMPTY_CONFIG.webhook, ...((g.config as any)?.webhook ?? {}), signature: { ...EMPTY_CONFIG.webhook.signature, ...((g.config as any)?.webhook?.signature ?? {}) } },
      verification: { ...EMPTY_CONFIG.verification, ...((g.config as any)?.verification ?? {}) },
      refund: { ...EMPTY_CONFIG.refund, ...((g.config as any)?.refund ?? {}) },
      request: { ...EMPTY_CONFIG.request, ...((g.config as any)?.request ?? {}) },
      checkout: { ...EMPTY_CONFIG.checkout, ...((g.config as any)?.checkout ?? {}) },
      response: { ...EMPTY_CONFIG.response, ...((g.config as any)?.response ?? {}) },
    },
    credentials: {},
  };
}

const STATUS_STYLES: Record<Gateway["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  testing: "bg-amber-100 text-amber-700",
  connected: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-600 text-white",
  error: "bg-red-100 text-red-700",
  disabled: "bg-slate-200 text-slate-700",
};

export function CustomGatewaySection({ storeId }: { storeId: string }) {
  const list = useServerFn(listCustomGateways);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["customPaymentGateways", storeId],
    queryFn: () => list({ data: { storeId } }),
    enabled: !!storeId,
  });
  const [open, setOpen] = useState<null | { mode: "new" } | { mode: "edit"; gateway: Gateway }>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["customPaymentGateways", storeId] });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Custom Payment Gateways</h2>
          <p className="text-xs text-muted-foreground">
            Connect any provider that isn't in the built-in list by describing its checkout, response and webhook contract.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen({ mode: "new" })}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Custom Gateway
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-sm text-muted-foreground">Loading…</div>
        ) : data && data.length > 0 ? (
          data.map((g: any) => (
            <CustomGatewayCard
              key={g.id}
              gateway={g as Gateway}
              onEdit={() => setOpen({ mode: "edit", gateway: g as Gateway })}
              onChange={refresh}
            />
          ))
        ) : (
          <button
            onClick={() => setOpen({ mode: "new" })}
            className="col-span-full grid place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground transition hover:bg-muted/60"
          >
            <Wand2 className="mb-2 h-6 w-6" />
            No custom gateways yet. Click to build your first one.
          </button>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <GatewayEditor
              storeId={storeId}
              initial={open.mode === "edit" ? seedFromGateway(open.gateway) : DEFAULT_FORM}
              existing={open.mode === "edit" ? open.gateway : null}
              onClose={() => setOpen(null)}
              onSaved={() => {
                refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CustomGatewayCard({
  gateway,
  onEdit,
  onChange,
}: {
  gateway: Gateway;
  onEdit: () => void;
  onChange: () => void;
}) {
  const toggle = useServerFn(setCustomGatewayEnabled);
  const del = useServerFn(deleteCustomGateway);
  const [busy, setBusy] = useState(false);
  const initials = gateway.name.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {gateway.logo_url ? (
            <img src={gateway.logo_url} alt={gateway.name} className="h-full w-full object-contain" />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold">{gateway.name}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[gateway.status]}`}>
              {gateway.status}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {gateway.environment === "sandbox" ? "Sandbox" : "Live"}
            </Badge>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {gateway.description || `${gateway.currency} · ${gateway.auth_type}`}
          </div>
          {gateway.credentials_preview && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">Key {gateway.credentials_preview}</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Configure
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Enabled</span>
          <Switch
            checked={gateway.is_active}
            disabled={busy}
            onCheckedChange={async (v) => {
              setBusy(true);
              try {
                await toggle({ data: { id: gateway.id, enabled: v } });
                toast.success(v ? "Enabled" : "Disabled");
                onChange();
              } catch (e: any) {
                toast.error(e?.message ?? "Failed to update");
              } finally {
                setBusy(false);
              }
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {gateway.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Customers will no longer be able to pay through this gateway. Webhook history will also be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await del({ data: { id: gateway.id } });
                      toast.success("Deleted");
                      onChange();
                    } catch (e: any) {
                      toast.error(e?.message ?? "Failed to delete");
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function GatewayEditor({
  storeId,
  initial,
  existing,
  onClose,
  onSaved,
}: {
  storeId: string;
  initial: EditorState;
  existing: Gateway | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditorState>(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string; redirect_url?: string | null }>(null);
  const save = useServerFn(saveCustomGateway);
  const test = useServerFn(testCustomGateway);
  const listEvents = useServerFn(listCustomGatewayEvents);
  const events = useQuery({
    queryKey: ["customGatewayEvents", existing?.id],
    queryFn: () => listEvents({ data: { gatewayId: existing!.id, limit: 20 } }),
    enabled: !!existing,
  });

  const webhookUrl = useMemo(() => {
    if (!existing) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/public/store-payments/custom-webhook/${storeId}/${existing.id}`;
  }, [existing, storeId]);

  useEffect(() => setForm(initial), [initial]);

  function update<K extends keyof EditorState>(k: K, v: EditorState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updateConfig(fn: (c: EditorState["config"]) => EditorState["config"]) {
    setForm((f) => ({ ...f, config: fn(f.config) }));
  }

  async function submit() {
    try {
      setSaving(true);
      const payload = {
        storeId,
        id: existing?.id,
        name: form.name.trim(),
        slug: (form.slug || form.name).toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        logo_url: form.logo_url || null,
        description: form.description || null,
        website_url: form.website_url || null,
        docs_url: form.docs_url || null,
        support_email: form.support_email || null,
        currency: form.currency,
        currencies: form.currencies,
        environment: form.environment,
        auth_type: form.auth_type,
        api_base_url: form.api_base_url || null,
        sandbox_base_url: form.sandbox_base_url || null,
        config: form.config,
        credentials: Object.fromEntries(Object.entries(form.credentials).filter(([, v]) => v && v.length > 0)),
      };
      const parsed = CustomGatewayConfigSchema.safeParse(payload.config);
      if (!parsed.success) {
        toast.error("Configuration is invalid: " + parsed.error.issues[0]?.message);
        return;
      }
      await save({ data: payload });
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!existing) {
      toast.info("Save the gateway before running a live test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await test({
        data: {
          id: existing.id,
          credentialsOverride: Object.keys(form.credentials).length > 0 ? form.credentials : undefined,
        },
      });
      setTestResult({
        ok: !!res.ok,
        message: res.ok
          ? `Connection succeeded (${res.status_code}). ${res.redirect_url ? "Checkout URL received." : "No checkout URL in response."}`
          : `Connection failed (${res.status_code}). ${res.error ?? res.message ?? ""}`,
        redirect_url: res.redirect_url,
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.message ?? "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  const canSave = form.name.trim().length >= 2 && form.api_base_url.trim().length > 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          {existing ? `Configure ${existing.name}` : "New custom gateway"}
        </SheetTitle>
        <SheetDescription>
          Describe how your provider expects the checkout request and how it reports success back to your store.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-4 pb-24">
        <Accordion type="multiple" defaultValue={["basic"]} className="w-full">
          {/* 1. Basic info */}
          <AccordionItem value="basic">
            <AccordionTrigger>1. Basic information</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Gateway name" required>
                  <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. My Local PSP" />
                </Field>
                <Field label="Slug" helper="Used in URLs. Lowercase, no spaces.">
                  <Input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="my-local-psp" />
                </Field>
                <Field label="Logo URL">
                  <Input value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://…" />
                </Field>
                <Field label="Support email">
                  <Input value={form.support_email} onChange={(e) => update("support_email", e.target.value)} placeholder="support@provider.com" />
                </Field>
                <Field label="Website">
                  <Input value={form.website_url} onChange={(e) => update("website_url", e.target.value)} />
                </Field>
                <Field label="Docs URL">
                  <Input value={form.docs_url} onChange={(e) => update("docs_url", e.target.value)} />
                </Field>
                <Field label="Currency">
                  <Input value={form.currency} onChange={(e) => update("currency", e.target.value.toUpperCase())} maxLength={4} />
                </Field>
                <Field label="Environment">
                  <Select value={form.environment} onValueChange={(v) => update("environment", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <Textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
              </Field>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Authentication */}
          <AccordionItem value="auth">
            <AccordionTrigger>2. Authentication</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Field label="Authentication type">
                <Select value={form.auth_type} onValueChange={(v) => update("auth_type", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <CredentialFields
                authType={form.auth_type}
                values={form.credentials}
                existingHint={existing?.credentials_preview ?? null}
                onChange={(k, v) => update("credentials", { ...form.credentials, [k]: v })}
              />
              <p className="text-[11px] text-muted-foreground">
                Credentials are encrypted at rest with AES-256-GCM and never returned to your browser. Leave fields blank to keep existing values.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Endpoints */}
          <AccordionItem value="endpoints">
            <AccordionTrigger>3. API endpoints</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <Field label="Live base URL" required>
                <Input value={form.api_base_url} onChange={(e) => update("api_base_url", e.target.value)} placeholder="https://api.provider.com" />
              </Field>
              <Field label="Sandbox base URL">
                <Input value={form.sandbox_base_url} onChange={(e) => update("sandbox_base_url", e.target.value)} placeholder="https://sandbox.provider.com" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Checkout method">
                  <Select
                    value={form.config.request.method}
                    onValueChange={(v) => updateConfig((c) => ({ ...c, request: { ...c.request, method: v as any } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["POST", "GET", "PUT", "PATCH"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Checkout endpoint" helper="Relative to base URL">
                  <Input
                    value={form.config.request.endpoint}
                    onChange={(e) => updateConfig((c) => ({ ...c, request: { ...c.request, endpoint: e.target.value } }))}
                    placeholder="/v1/checkout/session"
                  />
                </Field>
                <Field label="Content type">
                  <Select
                    value={form.config.request.contentType}
                    onValueChange={(v) => updateConfig((c) => ({ ...c, request: { ...c.request, contentType: v as any } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["json", "form_urlencoded", "form_data", "xml"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 4. Request mapping */}
          <AccordionItem value="request">
            <AccordionTrigger>4. Request mapping</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Use <code>{"{{order_id}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{customer_email}}"}</code>, <code>{"{{creds.api_key}}"}</code>, etc.
                Available variables: {InternalVariables.join(", ")}.
              </p>
              <Field label="Custom headers">
                <KeyValueEditor
                  rows={form.config.request.headers}
                  onChange={(rows) => updateConfig((c) => ({ ...c, request: { ...c.request, headers: rows } }))}
                  keyPlaceholder="Header"
                  valuePlaceholder="Value or {{template}}"
                />
              </Field>
              <Field label="Body template (optional — overrides mapping)">
                <Textarea
                  rows={5}
                  value={form.config.request.bodyTemplate}
                  onChange={(e) => updateConfig((c) => ({ ...c, request: { ...c.request, bodyTemplate: e.target.value } }))}
                  placeholder={`{\n  "amount": "{{amount}}",\n  "order_id": "{{order_id}}"\n}`}
                />
              </Field>
              <Field label="Field mapping" helper="Source → destination field on the provider's request body.">
                <MappingEditor
                  rows={form.config.request.mapping}
                  onChange={(rows) => updateConfig((c) => ({ ...c, request: { ...c.request, mapping: rows } }))}
                />
              </Field>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Response mapping */}
          <AccordionItem value="response">
            <AccordionTrigger>5. Response mapping</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Checkout type">
                  <Select
                    value={form.config.checkout.type}
                    onValueChange={(v) => updateConfig((c) => ({ ...c, checkout: { ...c.checkout, type: v as any } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["hosted", "redirect", "api_response_url", "embedded", "direct_api", "manual"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Redirect URL path" helper="Dotted path in the response JSON.">
                  <Input
                    value={form.config.checkout.responsePayUrlPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, checkout: { ...c.checkout, responsePayUrlPath: e.target.value } }))}
                    placeholder="data.checkout_url"
                  />
                </Field>
                <Field label="Transaction ID path">
                  <Input
                    value={form.config.response.transactionIdPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, response: { ...c.response, transactionIdPath: e.target.value } }))}
                  />
                </Field>
                <Field label="Reference path">
                  <Input
                    value={form.config.response.referencePath}
                    onChange={(e) => updateConfig((c) => ({ ...c, response: { ...c.response, referencePath: e.target.value } }))}
                  />
                </Field>
                <Field label="Status path">
                  <Input
                    value={form.config.response.statusPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, response: { ...c.response, statusPath: e.target.value } }))}
                  />
                </Field>
                <Field label="Message path">
                  <Input
                    value={form.config.response.messagePath}
                    onChange={(e) => updateConfig((c) => ({ ...c, response: { ...c.response, messagePath: e.target.value } }))}
                  />
                </Field>
              </div>
              <Field label="Status mapping" helper="Provider status → platform status.">
                <StatusMapEditor
                  rows={form.config.statusMap}
                  onChange={(rows) => updateConfig((c) => ({ ...c, statusMap: rows }))}
                />
              </Field>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Webhook */}
          <AccordionItem value="webhook">
            <AccordionTrigger>6. Webhook</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {existing ? (
                <Field label="Webhook URL (paste this in your provider dashboard)">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={webhookUrl} />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Save the gateway once to receive your webhook URL.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Signature type">
                  <Select
                    value={form.config.webhook.signature.type}
                    onValueChange={(v) =>
                      updateConfig((c) => ({ ...c, webhook: { ...c.webhook, signature: { ...c.webhook.signature, type: v as any } } }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["none", "hmac", "shared_secret", "custom"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Signature header">
                  <Input
                    value={form.config.webhook.signature.header}
                    onChange={(e) =>
                      updateConfig((c) => ({ ...c, webhook: { ...c.webhook, signature: { ...c.webhook.signature, header: e.target.value } } }))
                    }
                    placeholder="X-Signature"
                  />
                </Field>
                <Field label="Algorithm">
                  <Select
                    value={form.config.webhook.signature.algorithm}
                    onValueChange={(v) =>
                      updateConfig((c) => ({ ...c, webhook: { ...c.webhook, signature: { ...c.webhook.signature, algorithm: v as any } } }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["sha256", "sha512"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Encoding">
                  <Select
                    value={form.config.webhook.signature.encoding}
                    onValueChange={(v) =>
                      updateConfig((c) => ({ ...c, webhook: { ...c.webhook, signature: { ...c.webhook.signature, encoding: v as any } } }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["hex", "base64"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Event ID path" helper="Path used to deduplicate events.">
                  <Input
                    value={form.config.webhook.eventIdPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, webhook: { ...c.webhook, eventIdPath: e.target.value } }))}
                    placeholder="data.event_id"
                  />
                </Field>
                <Field label="Event type path">
                  <Input
                    value={form.config.webhook.eventTypePath}
                    onChange={(e) => updateConfig((c) => ({ ...c, webhook: { ...c.webhook, eventTypePath: e.target.value } }))}
                  />
                </Field>
                <Field label="Provider ref path">
                  <Input
                    value={form.config.webhook.providerRefPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, webhook: { ...c.webhook, providerRefPath: e.target.value } }))}
                  />
                </Field>
                <Field label="Status path">
                  <Input
                    value={form.config.webhook.statusPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, webhook: { ...c.webhook, statusPath: e.target.value } }))}
                  />
                </Field>
              </div>

              {existing && (
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Webhook className="h-4 w-4" /> Recent webhook events
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto text-xs">
                    {events.isLoading ? (
                      <div className="text-muted-foreground">Loading…</div>
                    ) : events.data && events.data.length > 0 ? (
                      events.data.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between gap-2 rounded border p-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {e.event_type ?? "event"} · {e.normalized_status ?? "—"}
                            </div>
                            <div className="truncate text-muted-foreground">
                              {new Date(e.created_at).toLocaleString()} · sig {String(e.signature_valid)}
                            </div>
                            {e.error_message && <div className="truncate text-destructive">{e.error_message}</div>}
                          </div>
                          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{e.processing_status}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No events received yet.</div>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* 7. Verification */}
          <AccordionItem value="verify">
            <AccordionTrigger>7. Payment verification</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Verification method">
                  <Select
                    value={form.config.verification.method}
                    onValueChange={(v) => updateConfig((c) => ({ ...c, verification: { ...c.verification, method: v as any } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["api_status", "webhook_only", "callback", "manual"].map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Verification endpoint">
                  <Input
                    value={form.config.verification.endpoint}
                    onChange={(e) => updateConfig((c) => ({ ...c, verification: { ...c.verification, endpoint: e.target.value } }))}
                    placeholder="/v1/transactions/{{transaction_id}}"
                  />
                </Field>
                <Field label="Success values" helper="Comma-separated provider status values that count as paid.">
                  <Input
                    value={form.config.verification.successValues.join(",")}
                    onChange={(e) =>
                      updateConfig((c) => ({
                        ...c,
                        verification: {
                          ...c.verification,
                          successValues: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="Status path">
                  <Input
                    value={form.config.verification.statusPath}
                    onChange={(e) => updateConfig((c) => ({ ...c, verification: { ...c.verification, statusPath: e.target.value } }))}
                  />
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 8. Refunds */}
          <AccordionItem value="refund">
            <AccordionTrigger>8. Refunds</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Refunds enabled</Label>
                <Switch
                  checked={form.config.refund.enabled}
                  onCheckedChange={(v) => updateConfig((c) => ({ ...c, refund: { ...c.refund, enabled: v } }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Refund endpoint">
                  <Input
                    value={form.config.refund.endpoint}
                    onChange={(e) => updateConfig((c) => ({ ...c, refund: { ...c.refund, endpoint: e.target.value } }))}
                    placeholder="/v1/refunds"
                  />
                </Field>
                <Field label="Refund method">
                  <Select
                    value={form.config.refund.httpMethod}
                    onValueChange={(v) => updateConfig((c) => ({ ...c, refund: { ...c.refund, httpMethod: v as any } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["POST", "PUT"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 9. Methods */}
          <AccordionItem value="methods">
            <AccordionTrigger>9. Displayed payment methods</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <MethodEditor
                rows={form.config.methods}
                onChange={(rows) => updateConfig((c) => ({ ...c, methods: rows }))}
              />
            </AccordionContent>
          </AccordionItem>

          {/* 10. Review */}
          <AccordionItem value="review">
            <AccordionTrigger>10. Review & test</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <ReviewLine label="Name" value={form.name} />
                <ReviewLine label="Environment" value={form.environment} />
                <ReviewLine label="Auth" value={form.auth_type} />
                <ReviewLine label="Currency" value={form.currency} />
                <ReviewLine label="Base URL" value={form.api_base_url} mono />
                <ReviewLine label="Checkout endpoint" value={form.config.request.endpoint} mono />
              </div>
              <Button variant="outline" onClick={runTest} disabled={testing} className="w-full">
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                Run test checkout call
              </Button>
              {testResult && (
                <div
                  className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                    testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div>{testResult.message}</div>
                    {testResult.redirect_url && (
                      <a
                        href={testResult.redirect_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate underline"
                      >
                        {testResult.redirect_url}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <SheetFooter className="sticky bottom-0 -mx-6 flex-col gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur sm:flex-col">
        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function Field({
  label,
  helper,
  required,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function ReviewLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded border p-2">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-[11px]" : "truncate"}>{value || "—"}</span>
    </div>
  );
}

function CredentialFields({
  authType,
  values,
  existingHint,
  onChange,
}: {
  authType: string;
  values: Record<string, string>;
  existingHint: string | null;
  onChange: (key: string, value: string) => void;
}) {
  const fields: { key: string; label: string; type?: string }[] = (() => {
    switch (authType) {
      case "api_key":
        return [{ key: "api_key", label: "API key", type: "password" }];
      case "api_key_secret":
        return [
          { key: "api_key", label: "API key", type: "password" },
          { key: "api_secret", label: "API secret", type: "password" },
        ];
      case "bearer":
        return [{ key: "bearer_token", label: "Bearer token", type: "password" }];
      case "basic":
        return [
          { key: "username", label: "Username" },
          { key: "password", label: "Password", type: "password" },
        ];
      case "oauth2":
        return [
          { key: "client_id", label: "Client ID" },
          { key: "client_secret", label: "Client secret", type: "password" },
        ];
      case "hmac":
        return [{ key: "hmac_secret", label: "HMAC secret", type: "password" }];
      case "custom_header":
        return [
          { key: "custom_header_name", label: "Header name" },
          { key: "custom_header_value", label: "Header value", type: "password" },
        ];
      default:
        return [];
    }
  })();

  if (fields.length === 0) return <p className="text-xs text-muted-foreground">No credentials required.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} helper={existingHint ? `Saved: ${existingHint}` : undefined}>
          <Input
            type={f.type ?? "text"}
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={existingHint ? "Leave blank to keep current" : ""}
          />
        </Field>
      ))}
    </div>
  );
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  rows: { key: string; value: string }[];
  onChange: (rows: { key: string; value: string }[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, key: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, value: e.target.value };
              onChange(next);
            }}
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

function MappingEditor({
  rows,
  onChange,
}: {
  rows: { source: string; target: string; staticValue?: string }[];
  onChange: (rows: { source: string; target: string; staticValue?: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select
            value={row.source}
            onValueChange={(v) => {
              const next = [...rows];
              next[i] = { ...row, source: v };
              onChange(next);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__static">Static value</SelectItem>
              {InternalVariables.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Target field, e.g. customer.email"
            value={row.target}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, target: e.target.value };
              onChange(next);
            }}
          />
          {row.source === "__static" && (
            <Input
              placeholder="Static value"
              value={row.staticValue ?? ""}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, staticValue: e.target.value };
                onChange(next);
              }}
            />
          )}
          <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { source: "order_id", target: "" }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Map field
      </Button>
    </div>
  );
}

function StatusMapEditor({
  rows,
  onChange,
}: {
  rows: { from: string; to: string }[];
  onChange: (rows: { from: string; to: any }[]) => void;
}) {
  const targets = ["pending", "processing", "paid", "failed", "cancelled", "refunded", "expired"];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Provider status (SUCCESS, FAILED…)"
            value={row.from}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, from: e.target.value };
              onChange(next);
            }}
          />
          <Select
            value={row.to}
            onValueChange={(v) => {
              const next = [...rows];
              next[i] = { ...row, to: v };
              onChange(next);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Platform status" /></SelectTrigger>
            <SelectContent>
              {targets.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { from: "", to: "paid" }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add status
      </Button>
    </div>
  );
}

function MethodEditor({
  rows,
  onChange,
}: {
  rows: { code: string; label: string; enabled: boolean; icon_url?: string }[];
  onChange: (rows: any[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
          <Input
            placeholder="Code (e.g. bkash)"
            value={row.code}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, code: e.target.value };
              onChange(next);
            }}
          />
          <Input
            placeholder="Display label"
            value={row.label}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, label: e.target.value };
              onChange(next);
            }}
          />
          <Switch
            checked={row.enabled}
            onCheckedChange={(v) => {
              const next = [...rows];
              next[i] = { ...row, enabled: v };
              onChange(next);
            }}
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, { code: "", label: "", enabled: true }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add method
      </Button>
    </div>
  );
}
