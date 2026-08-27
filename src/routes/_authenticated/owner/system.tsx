import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/owner/system")({ component: Page });

function Page() {
  const get = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "sysSettings"], queryFn: () => get() });
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !f) setF({
    platform_name: data.platform_name ?? "",
    logo_url: data.logo_url ?? "",
    domain: data.domain ?? "",
    currency: data.currency ?? "BDT",
    timezone: data.timezone ?? "Asia/Dhaka",
    contact_email: data.contact_email ?? "",
    support_phone: data.support_phone ?? "",
    maintenance_mode: !!data.maintenance_mode,
    maintenance_message: data.maintenance_message ?? "",
    email_from: data.email_from ?? "",
    sms_provider: data.sms_provider ?? "",
    whatsapp_number: data.whatsapp_number ?? "",
  }); }, [data]);

  if (!f) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  async function submit() {
    setSaving(true);
    try { await save({ data: { settings: f } }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["owner", "sysSettings"] }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const F = ({ k, label, type = "text", ph }: any) => (
    <div><Label>{label}</Label><Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} /></div>
  );

  return (
    <div>
      <OwnerPageHeader title="System Settings" description="Platform identity, contact, and integrations." />
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Branding</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <F k="platform_name" label="Platform name" ph="e.g. Shopio" />
            <F k="logo_url" label="Logo URL" />
            <F k="domain" label="Primary domain" ph="app.example.com" />
            <F k="currency" label="Currency" />
            <F k="timezone" label="Timezone" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <F k="contact_email" label="Contact email" type="email" />
            <F k="support_phone" label="Support phone" />
            <F k="email_from" label="Email 'from' address" />
            <F k="whatsapp_number" label="WhatsApp number" />
            <F k="sms_provider" label="SMS provider" ph="e.g. bulksmsbd" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Maintenance mode</h2>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.maintenance_mode} onCheckedChange={(v) => setF({ ...f, maintenance_mode: v })} /> Enable maintenance mode</label>
          <Textarea className="mt-3" rows={2} placeholder="Message shown to visitors" value={f.maintenance_message} onChange={(e) => setF({ ...f, maintenance_message: e.target.value })} />
        </div>
        <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}
