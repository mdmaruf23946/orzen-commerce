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
  const { data: banner } = useQuery({
    queryKey: ["owner", "globalBanner"],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("platform_global_banner" as any)
        .select("enabled,image_url,link_url,alt")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as { enabled: boolean; image_url: string | null; link_url: string | null; alt: string | null } | null;
    },
  });
  const [f, setF] = useState<any>(null);
  const [gb, setGB] = useState({ enabled: false, image_url: "", link_url: "", alt: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    if (banner) setGB({
      enabled: !!banner.enabled,
      image_url: banner.image_url ?? "",
      link_url: banner.link_url ?? "",
      alt: banner.alt ?? "",
    });
  }, [banner]);

  if (!f) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { settings: f } });
      const { error } = await supabase.from("platform_global_banner" as any).upsert({ id: 1, ...gb });
      if (error) throw new Error(error.message);
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["owner", "sysSettings"] });
      qc.invalidateQueries({ queryKey: ["owner", "globalBanner"] });
      qc.invalidateQueries({ queryKey: ["platform", "global-header-banner"] });
    }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function uploadBanner(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("File is too large (max 3 MB)");
    setUploading(true);
    try {
      const upload = file.type === "image/svg+xml" ? file : await compressImage(file, { maxEdge: 1920, quality: 0.92 });
      const ext = (upload.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
      const path = `platform-branding/global-banner/banner-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, upload, { upsert: true, contentType: upload.type });
      if (error) throw new Error(error.message);
      setGB((current) => ({ ...current, image_url: `/api/img/${path}` }));
      toast.success("Banner uploaded — save settings to publish it");
    } catch (error) {
      toast.error((error as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Storefront payment banner</h2>
              <p className="mt-1 text-sm text-muted-foreground">Shown below the header across every storefront. Merchants cannot change it.</p>
            </div>
            <Switch checked={gb.enabled} onCheckedChange={(enabled) => setGB({ ...gb, enabled })} aria-label="Enable storefront payment banner" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Banner image</Label>
              {gb.image_url && (
                <div className="flex min-h-14 items-center justify-center overflow-hidden rounded-md border bg-background p-2">
                  <img src={gb.image_url} alt={gb.alt || "Payment banner preview"} className="max-h-14 w-full object-contain" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : gb.image_url ? "Replace banner" : "Upload banner"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadBanner(file);
                    event.target.value = "";
                  }} />
                </label>
                {gb.image_url && <Button type="button" variant="outline" onClick={() => setGB({ ...gb, image_url: "" })}>Remove image</Button>}
              </div>
            </div>
            <div><Label>Optional link</Label><Input type="url" value={gb.link_url} onChange={(e) => setGB({ ...gb, link_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Image description</Label><Input value={gb.alt} onChange={(e) => setGB({ ...gb, alt: e.target.value })} placeholder="Accepted payment methods" /></div>
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
