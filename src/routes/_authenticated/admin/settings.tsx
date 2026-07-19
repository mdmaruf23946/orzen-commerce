import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMyStore,
  updateMyStore,
  resetStoreToTemplate,
  adminGetRequireCustomerLogin,
  adminSetRequireCustomerLogin,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";
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

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetchStore = useServerFn(getMyStore);
  const save = useServerFn(updateMyStore);
  const resetFn = useServerFn(resetStoreToTemplate);
  const qc = useQueryClient();
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    setResetting(true);
    try {
      await resetFn();
      await qc.invalidateQueries();
      toast.success("Store reset to the latest default template.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResetting(false);
    }
  }


  useEffect(() => {
    if (store) setForm({ ...store });
  }, [store]);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  function set<K extends string>(k: K, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          name: form.name,
          slug: form.slug,
          description: form.description,
          logo_url: form.logo_url,
          phone: form.phone,
          whatsapp: form.whatsapp,
          facebook: form.facebook,
          address: form.address,
          primary_color: form.primary_color || "#0f172a",
          header_color: form.header_color || null,
          title_bar_color: form.title_bar_color || null,
          footer_color: form.footer_color || null,
          button_color: form.button_color || null,
          bkash_number: form.bkash_number,
          nagad_number: form.nagad_number,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Store Settings</h1>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Branding</h2>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <ImageUploader storeId={form.id} value={form.logo_url} onChange={(v) => set("logo_url", v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="n">Store name</Label>
            <Input id="n" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s">Slug</Label>
            <Input id="s" required value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc">Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              id="pc"
              type="color"
              value={form.primary_color || "#0f172a"}
              onChange={(e) => set("primary_color", e.target.value)}
              className="h-10 w-14 rounded-md border"
            />
            <Input value={form.primary_color || ""} onChange={(e) => set("primary_color", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ph">Phone</Label>
            <Input id="ph" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp</Label>
            <Input id="wa" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb">Facebook link</Label>
          <Input id="fb" value={form.facebook ?? ""} onChange={(e) => set("facebook", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad">Address</Label>
          <Textarea id="ad" rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Mobile wallet (manual)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bk">bKash number</Label>
            <Input id="bk" value={form.bkash_number ?? ""} onChange={(e) => set("bkash_number", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ng">Nagad number</Label>
            <Input id="ng" value={form.nagad_number ?? ""} onChange={(e) => set("nagad_number", e.target.value)} />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save changes"}
      </Button>

      <section className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Replace your current design, theme, banners, categories and products with the latest default template
          set by the platform. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm" disabled={resetting}>
              {resetting ? "Resetting…" : "Reset to Default Template"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to default template?</AlertDialogTitle>
              <AlertDialogDescription>
                Your current banners, categories and products will be deleted and replaced with the platform's
                latest default template. Your store settings (design, theme, defaults) will also be overwritten.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={reset}>Yes, reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </form>
  );
}
