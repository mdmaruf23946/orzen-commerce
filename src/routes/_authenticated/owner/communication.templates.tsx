import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { listOwnerTemplates, saveOwnerTemplate, deleteOwnerTemplate } from "@/lib/communication.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/owner/communication/templates")({
  component: TemplatesPage,
});

type Tpl = {
  id?: string; name: string; subject: string; body_html: string;
  notification_title: string; notification_body: string;
};
const empty: Tpl = { name: "", subject: "", body_html: "", notification_title: "", notification_body: "" };

function TemplatesPage() {
  const list = useServerFn(listOwnerTemplates);
  const save = useServerFn(saveOwnerTemplate);
  const del = useServerFn(deleteOwnerTemplate);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner-tpls-full"], queryFn: () => list() });
  const [editing, setEditing] = useState<Tpl>(empty);

  function edit(t: any) {
    setEditing({
      id: t.id, name: t.name ?? "", subject: t.subject ?? "",
      body_html: t.body_html ?? "",
      notification_title: t.notification_title ?? "",
      notification_body: t.notification_body ?? "",
    });
  }

  async function doSave() {
    if (!editing.name.trim() || !editing.subject.trim()) return toast.error("Name and subject required");
    try {
      await save({ data: {
        id: editing.id, name: editing.name, subject: editing.subject,
        body_html: editing.body_html,
        notification_title: editing.notification_title || null,
        notification_body: editing.notification_body || null,
      } as any });
      toast.success("Saved");
      setEditing(empty);
      qc.invalidateQueries({ queryKey: ["owner-tpls-full"] });
      qc.invalidateQueries({ queryKey: ["owner-tpls"] });
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }

  async function doDelete(id: string) {
    if (!confirm("Delete template?")) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["owner-tpls-full"] });
      qc.invalidateQueries({ queryKey: ["owner-tpls"] });
      if (editing.id === id) setEditing(empty);
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold">Templates</div>
          <Button size="sm" variant="outline" onClick={() => setEditing(empty)}>
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>
        <div className="divide-y">
          {(data as any[]).length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No templates yet.</div>
          )}
          {(data as any[]).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => edit(t)}>
                <div className="truncate font-medium">{t.name}</div>
                <div className="truncate text-xs text-muted-foreground">{t.subject}</div>
              </button>
              <button className="p-1 text-rose-600 hover:bg-rose-50" onClick={() => doDelete(t.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="font-semibold">{editing.id ? "Edit template" : "New template"}</div>
        <div>
          <Label>Template name</Label>
          <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
        </div>
        <div>
          <Label>Email body (HTML)</Label>
          <Textarea rows={10} value={editing.body_html} onChange={(e) => setEditing({ ...editing, body_html: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>In-app title</Label>
            <Input value={editing.notification_title} onChange={(e) => setEditing({ ...editing, notification_title: e.target.value })} />
          </div>
          <div>
            <Label>In-app body</Label>
            <Input value={editing.notification_body} onChange={(e) => setEditing({ ...editing, notification_body: e.target.value })} />
          </div>
        </div>
        <Button onClick={doSave}><Save className="mr-1 h-4 w-4" /> Save template</Button>
      </div>
    </div>
  );
}
