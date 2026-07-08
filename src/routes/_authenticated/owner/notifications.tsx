import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Send } from "lucide-react";
import { listAnnouncements, upsertAnnouncement, deleteAnnouncement } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/notifications")({ component: Page });

function Page() {
  const list = useServerFn(listAnnouncements);
  const upsert = useServerFn(upsertAnnouncement);
  const del = useServerFn(deleteAnnouncement);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "announce"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" as const, publish: false });

  async function save(publish = false) {
    try { await upsert({ data: { ...form, publish } }); toast.success(publish ? "Published" : "Saved"); setOpen(false); setForm({ title: "", body: "", audience: "all", publish: false }); qc.invalidateQueries({ queryKey: ["owner", "announce"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <OwnerPageHeader title="Notification Center" description="Broadcast announcements to your stores."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New announcement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Body</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                <div><Label>Audience</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as any })}>
                    <option value="all">All stores</option><option value="active">Active only</option><option value="trial">Trial only</option><option value="expired">Expired only</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => save(false)}>Save draft</Button>
                <Button onClick={() => save(true)}><Send className="mr-1 h-4 w-4" />Publish</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-2">
        {(data as any[]).length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No announcements.</div>}
        {(data as any[]).map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{a.title}</div>
                  {a.published_at ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Published</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Draft</span>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                <div className="mt-1 text-xs text-muted-foreground">Audience: {a.audience} · {new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-1">
                {!a.published_at && <Button size="sm" variant="outline" onClick={async () => { await upsert({ data: { id: a.id, title: a.title, body: a.body, audience: a.audience, publish: true } }); qc.invalidateQueries({ queryKey: ["owner", "announce"] }); }}><Send className="mr-1 h-3 w-3" />Publish</Button>}
                <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await del({ data: { id: a.id } }); qc.invalidateQueries({ queryKey: ["owner", "announce"] }); } }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
