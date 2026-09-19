import { FeatureGate } from "@/components/admin/FeatureGate";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, Mail, Smartphone } from "lucide-react";
import {
  getNotificationSettings,
  saveNotificationChannel,
  testNotificationChannel,
} from "@/lib/notify-settings.functions";
import { computeState, defaultSettings, type EventMap } from "@/lib/notify-settings";
import { ChannelCard } from "@/components/admin/notifications/ChannelCard";
import { EventMatrix } from "@/components/admin/notifications/EventMatrix";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings — ORZEN Merchant Panel" },
      { name: "description", content: "WhatsApp, email and SMS notification channels and events." },
      { property: "og:title", content: "Notification Settings — ORZEN Merchant Panel" },
      { property: "og:description", content: "WhatsApp, email and SMS notification channels and events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="notifications">
      <NotificationsPage />
    </FeatureGate>
  ),
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NotificationsPage() {
  const load = useServerFn(getNotificationSettings);
  const save = useServerFn(saveNotificationChannel);
  const test = useServerFn(testNotificationChannel);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["notify-settings"],
    queryFn: () => load(),
  });

  const base = useMemo(() => (data as any) ?? defaultSettings(), [data]);
  const [wa, setWa] = useState<any>(base.whatsapp);
  const [em, setEm] = useState<any>(base.email);
  const [sms, setSms] = useState<any>(base.sms);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, "save" | "test" | null>>({});

  useEffect(() => {
    setWa(base.whatsapp);
    setEm(base.email);
    setSms(base.sms);
    setDirty({});
  }, [base]);

  const mark = (k: string) => setDirty((d) => ({ ...d, [k]: true }));
  const upd = (setter: (fn: (p: any) => any) => void, key: string) => (patch: any) => {
    setter((p: any) => ({ ...p, ...patch }));
    mark(key);
  };
  const setWaField = upd(setWa, "whatsapp");
  const setEmField = upd(setEm, "email");
  const setSmsField = upd(setSms, "sms");

  async function doSave(channel: "whatsapp" | "email" | "sms", payload: any) {
    setBusy((b) => ({ ...b, [channel]: "save" }));
    try {
      await save({ data: { channel, ...payload } });
      toast.success("Saved");
      setDirty((d) => ({ ...d, [channel]: false }));
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy((b) => ({ ...b, [channel]: null }));
    }
  }

  async function doTest(channel: "whatsapp" | "email" | "sms") {
    setBusy((b) => ({ ...b, [channel]: "test" }));
    try {
      const r: any = await test({ data: { channel } });
      if (r.ok) toast.success("Test message sent");
      else toast.error(r.error ?? "Test failed");
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy((b) => ({ ...b, [channel]: null }));
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading notification settings…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Notification Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose how your store sends order, payment, return and shipping updates. Each channel is saved and
          tested separately.
        </p>
      </div>

      {/* WhatsApp */}
      <ChannelCard
        title="WhatsApp"
        description="Meta WhatsApp Cloud API"
        icon={<MessageCircle className="h-4 w-4" />}
        state={computeState("whatsapp", wa)}
        lastError={wa?.status?.last_error}
        lastTestedAt={wa?.status?.last_tested_at}
        enabled={!!wa?.enabled}
        onEnabledChange={(v) => setWaField({ enabled: v })}
        dirty={!!dirty.whatsapp}
        saving={busy.whatsapp === "save"}
        testing={busy.whatsapp === "test"}
        onTest={() => doTest("whatsapp")}
        onSave={() =>
          doSave("whatsapp", {
            enabled: !!wa.enabled,
            number: wa.number ?? "",
            phone_number_id: wa.phone_number_id ?? "",
            template_name: wa.template_name ?? "",
            access_token: wa.access_token || undefined,
            events: wa.events as EventMap,
          })
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin WhatsApp number" hint="Country code without +, e.g. 8801XXXXXXXXX">
            <Input value={wa?.number ?? ""} onChange={(e) => setWaField({ number: e.target.value })} />
          </Field>
          <Field label="Phone Number ID">
            <Input
              value={wa?.phone_number_id ?? ""}
              onChange={(e) => setWaField({ phone_number_id: e.target.value })}
            />
          </Field>
          <Field
            label="Access token"
            hint={wa?.has_token ? "A token is saved. Type a new one to replace it." : "Permanent token from Meta."}
          >
            <Input
              type="password"
              placeholder={wa?.has_token ? "••••••••••••" : ""}
              value={wa?.access_token ?? ""}
              onChange={(e) => setWaField({ access_token: e.target.value })}
            />
          </Field>
          <Field label="Template name (optional)">
            <Input
              value={wa?.template_name ?? ""}
              onChange={(e) => setWaField({ template_name: e.target.value })}
            />
          </Field>
        </div>
        <EventMatrix value={wa?.events ?? {}} onChange={(events) => setWaField({ events })} />
      </ChannelCard>

      {/* Email */}
      <ChannelCard
        title="Email"
        description="Platform email for your inbox; customer email only through your own Resend account"
        icon={<Mail className="h-4 w-4" />}
        state={computeState("email", em)}
        lastError={em?.status?.last_error}
        lastTestedAt={em?.status?.last_tested_at}
        enabled={!!em?.enabled}
        onEnabledChange={(v) => setEmField({ enabled: v })}
        dirty={!!dirty.email}
        saving={busy.email === "save"}
        testing={busy.email === "test"}
        onTest={() => doTest("email")}
        onSave={() =>
          doSave("email", {
            enabled: !!em.enabled,
            provider: em.provider === "resend" ? "resend" : "platform",
            address: em.address ?? "",
            from_address: em.from_address ?? "",
            api_key: em.api_key || undefined,
            events: em.events as EventMap,
          })
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notification email address">
            <Input value={em?.address ?? ""} onChange={(e) => setEmField({ address: e.target.value })} />
          </Field>
          <Field label="Provider">
            <select
              value={em?.provider ?? "platform"}
              onChange={(e) => setEmField({ provider: e.target.value })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="platform">Platform email (merchant inbox only)</option>
              <option value="resend">Resend (own account)</option>
            </select>
          </Field>
          {em?.provider === "resend" && (
            <>
              <Field label="From address" hint="Must be a domain verified in Resend.">
                <Input
                  value={em?.from_address ?? ""}
                  onChange={(e) => setEmField({ from_address: e.target.value })}
                />
              </Field>
              <Field
                label="Resend API key"
                hint={em?.has_api_key ? "A key is saved. Type a new one to replace it." : undefined}
              >
                <Input
                  type="password"
                  placeholder={em?.has_api_key ? "••••••••••••" : ""}
                  value={em?.api_key ?? ""}
                  onChange={(e) => setEmField({ api_key: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
        <EventMatrix value={em?.events ?? {}} onChange={(events) => setEmField({ events })} />
      </ChannelCard>

      {/* SMS */}
      <ChannelCard
        title="SMS"
        description="BulkSMSBD"
        icon={<Smartphone className="h-4 w-4" />}
        state={computeState("sms", sms)}
        lastError={sms?.status?.last_error}
        lastTestedAt={sms?.status?.last_tested_at}
        enabled={!!sms?.enabled}
        onEnabledChange={(v) => setSmsField({ enabled: v })}
        dirty={!!dirty.sms}
        saving={busy.sms === "save"}
        testing={busy.sms === "test"}
        onTest={() => doTest("sms")}
        onSave={() =>
          doSave("sms", {
            enabled: !!sms.enabled,
            number: sms.number ?? "",
            sender_id: sms.sender_id ?? "",
            api_key: sms.api_key || undefined,
            events: sms.events as EventMap,
          })
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin mobile number" hint="e.g. 8801XXXXXXXXX">
            <Input value={sms?.number ?? ""} onChange={(e) => setSmsField({ number: e.target.value })} />
          </Field>
          <Field label="Sender ID">
            <Input value={sms?.sender_id ?? ""} onChange={(e) => setSmsField({ sender_id: e.target.value })} />
          </Field>
          <Field
            label="BulkSMSBD API key"
            hint={sms?.has_api_key ? "A key is saved. Type a new one to replace it." : undefined}
          >
            <Input
              type="password"
              placeholder={sms?.has_api_key ? "••••••••••••" : ""}
              value={sms?.api_key ?? ""}
              onChange={(e) => setSmsField({ api_key: e.target.value })}
            />
          </Field>
        </div>
        <EventMatrix value={sms?.events ?? {}} onChange={(events) => setSmsField({ events })} />
      </ChannelCard>
    </div>
  );
}
