import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPixelDefaults, updatePixelDefaults } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/owner/marketing")({ component: Page });

function Page() {
  const get = useServerFn(getPixelDefaults);
  const save = useServerFn(updatePixelDefaults);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "pixels"], queryFn: () => get() });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !form) setForm({ fb_pixel_id: data.fb_pixel_id ?? "", ga4_id: data.ga4_id ?? "", gtm_id: data.gtm_id ?? "", tiktok_id: data.tiktok_id ?? "", capi_token: data.capi_token ?? "" }); }, [data]);

  if (!form) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  async function submit() {
    setSaving(true);
    try { await save({ data: form }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["owner", "pixels"] }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const fields: [keyof typeof form, string, string][] = [
    ["fb_pixel_id", "Facebook Pixel ID", "1234567890"],
    ["ga4_id", "Google Analytics 4 ID", "G-XXXXXXX"],
    ["gtm_id", "Google Tag Manager", "GTM-XXXXX"],
    ["tiktok_id", "TikTok Pixel ID", ""],
  ];

  return (
    <div>
      <OwnerPageHeader title="Marketing Pixels" description="Platform-wide defaults injected into every storefront." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(([k, label, ph]) => (
          <div key={k as string} className="rounded-xl border bg-card p-4">
            <Label>{label}</Label>
            <Input value={(form as any)[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph} />
          </div>
        ))}
        <div className="rounded-xl border bg-card p-4 sm:col-span-2">
          <Label>Facebook Conversions API access token</Label>
          <Input type="password" value={form.capi_token} onChange={(e) => setForm({ ...form, capi_token: e.target.value })} />
        </div>
      </div>
      <Button className="mt-4" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save defaults"}</Button>
    </div>
  );
}
