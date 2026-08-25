import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { getFooterSettings, updateFooterSettings, FOOTER_FALLBACK, type FooterSettings } from "@/lib/footer.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PLATFORMS = ["facebook", "linkedin", "youtube", "instagram", "twitter", "whatsapp", "telegram", "email", "website"];

export const Route = createFileRoute("/_authenticated/owner/footer")({
  head: () => ({
    meta: [
      { title: "Footer Settings — ORZEN Owner Panel" },
      { name: "description", content: "Manage the landing page footer links, socials and contact details." },
      { property: "og:title", content: "Footer Settings — ORZEN Owner Panel" },
      { property: "og:description", content: "Manage the landing page footer links, socials and contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const get = useServerFn(getFooterSettings);
  const save = useServerFn(updateFooterSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "footer"], queryFn: () => get() });
  const [f, setF] = useState<FooterSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !f) setF({ ...FOOTER_FALLBACK, ...(data as FooterSettings) });
  }, [data]);

  if (!f) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const set = (patch: Partial<FooterSettings>) => setF({ ...f, ...patch });

  async function submit() {
    setSaving(true);
    try {
      await save({ data: f });
      toast.success("Footer updated");
      qc.invalidateQueries({ queryKey: ["owner", "footer"] });
      qc.invalidateQueries({ queryKey: ["platform", "footer"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <OwnerPageHeader title="Footer Settings" description="Everything shown in the landing page footer." />
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Branding</h2>
          <Label>Short description</Label>
          <Textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />
          <div className="mt-3">
            <Label>Bottom note</Label>
            <Input value={f.bottom_note} onChange={(e) => set({ bottom_note: e.target.value })} />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Email</Label>
              <Input value={f.contact?.email ?? ""} onChange={(e) => set({ contact: { ...f.contact, email: e.target.value } })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={f.contact?.phone ?? ""} onChange={(e) => set({ contact: { ...f.contact, phone: e.target.value } })} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={f.contact?.address ?? ""} onChange={(e) => set({ contact: { ...f.contact, address: e.target.value } })} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Social links</h2>
            <Button size="sm" variant="outline" className="gap-1"
              onClick={() => set({ socials: [...f.socials, { platform: "facebook", url: "" }] })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {f.socials.map((s, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={s.platform}
                  onChange={(e) => {
                    const next = [...f.socials]; next[i] = { ...s, platform: e.target.value }; set({ socials: next });
                  }}
                >
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <Input
                  className="col-span-2 sm:col-span-1"
                  placeholder="https://…"
                  value={s.url}
                  onChange={(e) => { const next = [...f.socials]; next[i] = { ...s, url: e.target.value }; set({ socials: next }); }}
                />
                <Button size="icon" variant="ghost" onClick={() => set({ socials: f.socials.filter((_, x) => x !== i) })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Link columns</h2>
            <Button size="sm" variant="outline" className="gap-1"
              onClick={() => set({ columns: [...f.columns, { title: "New column", links: [] }] })}>
              <Plus className="h-4 w-4" /> Add column
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {f.columns.map((c, ci) => (
              <div key={ci} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={c.title}
                    onChange={(e) => { const next = [...f.columns]; next[ci] = { ...c, title: e.target.value }; set({ columns: next }); }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => set({ columns: f.columns.filter((_, x) => x !== ci) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {c.links.map((l, li) => (
                    <div key={li} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                      <Input placeholder="Label" value={l.label}
                        onChange={(e) => {
                          const next = [...f.columns];
                          const links = [...c.links]; links[li] = { ...l, label: e.target.value };
                          next[ci] = { ...c, links }; set({ columns: next });
                        }} />
                      <Input placeholder="/privacy-policy" value={l.href}
                        onChange={(e) => {
                          const next = [...f.columns];
                          const links = [...c.links]; links[li] = { ...l, href: e.target.value };
                          next[ci] = { ...c, links }; set({ columns: next });
                        }} />
                      <Button size="icon" variant="ghost"
                        onClick={() => {
                          const next = [...f.columns];
                          next[ci] = { ...c, links: c.links.filter((_, x) => x !== li) };
                          set({ columns: next });
                        }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => {
                      const next = [...f.columns];
                      next[ci] = { ...c, links: [...c.links, { label: "", href: "" }] };
                      set({ columns: next });
                    }}>
                    <Plus className="h-4 w-4" /> Add link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Save footer"}
        </Button>
      </div>
    </div>
  );
}
