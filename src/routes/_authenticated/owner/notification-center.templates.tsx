import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Copy } from "lucide-react";
import { listTemplates, saveTemplate, deleteTemplate } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/notification-center/templates")({ component: Page });

function Page() {
  const list = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const del = useServerFn(deleteTemplate);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["notif-templates"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "announcement", priority: "normal" as const, title: "", body_html: "" });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => { setForm({ name: "", type: "announcement", priority: "normal", title: "", body_html: "" }); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />New template
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {(data as any[]).length === 0 && <div className="col-span-full rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No templates.</div>}
        {(data as any[]).map((t) => (
          <div key={t.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.type} · {t.priority}</div>
                <div className="mt-1 truncate text-sm">{t.title}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" title="Use in compose" onClick={() => {
                  const url = `/owner/notification-center/compose`;
                  sessionStorage.setItem("notif-tpl", JSON.stringify(t));
                  nav({ to: url, search: {} } as any);
                }}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm("Delete?")) return;
                  await del({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["notif-templates"] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Body (HTML)</Label><Textarea rows={6} value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try { await save({ data: form as any }); toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["notif-templates"] }); }
              catch (e) { toast.error((e as Error).message); }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
