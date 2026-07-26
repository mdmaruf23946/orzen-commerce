import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Truck, Palette } from "lucide-react";
import { listCouriers, upsertCourier } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/couriers")({ component: Page });

type F = {
  id?: string;
  name: string;
  code: string;
  base_url: string;
  api_key: string;
  clear_api_key: boolean;
  is_default: boolean;
  is_active: boolean;
};
const empty: F = { name: "", code: "", base_url: "", api_key: "", clear_api_key: false, is_default: false, is_active: true };

function logoSrc(v: string | null | undefined) {
  if (!v) return null;
  return v.startsWith("http") ? v : `/api/img/${v}`;
}

function Page() {
  const list = useServerFn(listCouriers);
  const upsert = useServerFn(upsertCourier);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "couriers"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<F>(empty);

  function editRow(r: any) {
    setForm({
      id: r.id,
      name: r.name,
      code: r.code,
      base_url: r.base_url ?? "",
      api_key: "",
      clear_api_key: false,
      is_default: r.is_default,
      is_active: r.is_active,
    });
    setOpen(true);
  }

  async function save() {
    try {
      await upsert({ data: { ...form, config: {} } });
      toast.success("Saved");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["owner", "couriers"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Courier Credentials"
        description="Manage platform-wide API credentials and defaults. Branding (logo, colors, description, links) is managed in Courier Brand Assets."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/owner/courier-brand-assets"><Palette className="mr-1 h-4 w-4" />Manage branding</Link>
          </Button>
        }
      />
      {(data as any[]).length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No courier providers yet. Add one from Courier Brand Assets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data as any[]).map((r) => {
            const src = logoSrc(r.logo_url);
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white p-1 dark:bg-white/95">
                    {src ? (
                      <img src={src} alt={r.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                    ) : (
                      <Truck className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.code}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {r.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Default</span>}
                    {r.is_active ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Active</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Inactive</span>}
                  </div>
                </div>
                {r.base_url && <div className="mb-1 truncate text-xs text-muted-foreground">{r.base_url}</div>}
                <div className="mb-3 text-xs text-muted-foreground">API key: {r.has_api_key ? r.api_key_masked : "—"}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => editRow(r)}><Pencil className="mr-1 h-3 w-3" />Edit credentials</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit courier credentials</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} disabled /></div>
            <div><Label>Code</Label><Input value={form.code} disabled /></div>
            <div className="sm:col-span-2"><Label>Base URL</Label><Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>API key {form.id ? "(leave blank to keep)" : ""}</Label>
              <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
              {form.id && <label className="mt-1 flex items-center gap-2 text-xs"><Switch checked={form.clear_api_key} onCheckedChange={(v) => setForm({ ...form, clear_api_key: v })} /> Clear existing key</label>}
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} /> Default</label>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

