import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, XCircle, AlertTriangle, Loader2, Wrench, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listStorePaymentGateways,
  saveStorePaymentGateway,
  testStorePaymentGateway,
  setActiveStorePaymentGateway,
  toggleStorePaymentGateway,
  disconnectStorePaymentGateway,
} from "@/lib/store-payments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/admin/payment-gateway")({
  component: PaymentGatewayPage,
});

type Gateway = Awaited<ReturnType<typeof listStorePaymentGateways>>[number];

function StatusPill({ g }: { g: Gateway }) {
  const c = g.connection;
  if (!c) return <Badge variant="secondary">Not connected</Badge>;
  if (c.status === "connected" && c.enabled)
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
      </Badge>
    );
  if (c.status === "error")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Error
      </Badge>
    );
  if (!c.enabled) return <Badge variant="secondary">Disabled</Badge>;
  return <Badge variant="outline">Untested</Badge>;
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

  const refresh = () => qc.invalidateQueries({ queryKey: ["storePaymentGateways", storeId] });

  if (!storeId || isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Payment Gateway</h1>
        <p className="text-sm text-muted-foreground">
          Connect your own merchant account. Customer payments go directly to you.
        </p>
      </header>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Active gateway</div>
            {active ? (
              <div className="mt-1 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="font-semibold">{active.label}</span>
                <Badge variant="outline">{active.connection?.sandbox ? "Sandbox" : "Live"}</Badge>
                <StatusPill g={active} />
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> No active gateway — online payment is hidden at checkout.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((g) => (
          <GatewayCard
            key={g.provider_id}
            g={g}
            storeId={storeId}
            onConfigure={() => setOpenId(g.provider_id)}
            onChange={refresh}
          />
        ))}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
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

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    try {
      const r: any = await fn();
      if (action === "test") {
        if (r?.ok) toast.success(r.message ?? "Connected");
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

  const c = g.connection;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{g.label}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {g.methods.slice(0, 4).map((m) => (
              <Badge key={m} variant="outline" className="text-[10px]">
                {m}
              </Badge>
            ))}
          </div>
        </div>
        <StatusPill g={g} />
      </div>

      {c && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {c.credentials_preview && <div>Key: {c.credentials_preview}</div>}
          <div>Mode: {c.sandbox ? "Sandbox" : "Live"}</div>
          {c.connected_at && <div>Connected: {new Date(c.connected_at).toLocaleString()}</div>}
          {c.last_test_result && (
            <div>Last test: {(c.last_test_result as any)?.message ?? "—"}</div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant={c ? "outline" : "default"} onClick={onConfigure}>
          <Wrench className="mr-1 h-3.5 w-3.5" /> {c ? "Update" : "Connect"}
        </Button>
        {c && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "test"}
              onClick={() =>
                run("test", () => test({ data: { storeId, providerId: g.provider_id } }))
              }
            >
              {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
            </Button>
            {!c.is_active && c.status === "connected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  run("active", () => setActive({ data: { storeId, providerId: g.provider_id } }))
                }
              >
                <Star className="mr-1 h-3.5 w-3.5" /> Set active
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1 text-xs">
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
              className="text-destructive"
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
  const [creds, setCreds] = useState<Record<string, string>>(() =>
    Object.fromEntries(g.credentialFields.map((f) => [f.key, ""])),
  );
  const [sandbox, setSandbox] = useState(g.connection?.sandbox ?? true);
  const [enabled, setEnabled] = useState(g.connection?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res: any = await save({
        data: { storeId, providerId: g.provider_id, credentials: creds, sandbox, enabled },
      });
      if (res?.ok) {
        toast.success(res.message ?? "Connected");
        onDone();
      } else {
        toast.error(res?.error ?? "Invalid credentials");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Configure {g.label}</SheetTitle>
        <SheetDescription>
          Credentials are encrypted before storage and never shown after save.
        </SheetDescription>
      </SheetHeader>
      <div className="my-4 space-y-4">
        {g.credentialFields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type={f.type === "password" ? "password" : "text"}
              placeholder={
                g.connection?.has_credentials
                  ? `Leave blank to keep existing (${g.connection.credentials_preview ?? "••••"})`
                  : f.placeholder
              }
              value={creds[f.key] ?? ""}
              onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
            />
            {f.helper && <p className="text-xs text-muted-foreground">{f.helper}</p>}
          </div>
        ))}
        {g.supportsSandbox && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="sb">Sandbox mode</Label>
            <Switch id="sb" checked={sandbox} onCheckedChange={setSandbox} />
          </div>
        )}
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="en">Enabled</Label>
          <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>
      <SheetFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Validate & Save
        </Button>
      </SheetFooter>
    </>
  );
}
