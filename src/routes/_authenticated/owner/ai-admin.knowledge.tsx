import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { listKnowledgeEntries, saveKnowledgeEntry, deleteKnowledgeEntry } from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/knowledge")({ component: Page });

const CATEGORIES = [
  { key: "business", label: "Business information" },
  { key: "features", label: "Features" },
  { key: "pricing", label: "Pricing" },
  { key: "plans", label: "Plans" },
  { key: "faq", label: "FAQ" },
  { key: "howto", label: "How-to guide" },
  { key: "support", label: "Support information" },
  { key: "contact", label: "Contact information" },
  { key: "policy", label: "Policy" },
  { key: "other", label: "Other" },
];

type Entry = {
  id?: string;
  category: string;
  title: string;
  body: string;
  published: boolean;
  sort_order: number;
};

const BLANK: Entry = { category: "faq", title: "", body: "", published: true, sort_order: 0 };

function EntryForm({ value, onDone }: { value: Entry; onDone: () => void }) {
  const save = useServerFn(saveKnowledgeEntry);
  const remove = useServerFn(deleteKnowledgeEntry);
  const qc = useQueryClient();
  const [form, setForm] = useState<Entry>(value);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    try {
      await save({ data: form as any });
      qc.invalidateQueries({ queryKey: ["ai-admin", "kb"] });
      toast.success("Saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!form.id) return onDone();
    setBusy(true);
    try {
      await remove({ data: { id: form.id } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "kb"] });
      toast.success("Deleted");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr_110px]">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Order</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Public answer / content</Label>
          <Textarea
            rows={5}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Only information that is safe for any customer to read."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
            <span className="text-sm">Published</span>
          </div>
          <div className="ml-auto flex gap-2">
            {form.id ? (
              <Button variant="outline" size="sm" onClick={del} disabled={busy}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDone} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const list = useServerFn(listKnowledgeEntries);
  const { data = [] } = useQuery({ queryKey: ["ai-admin", "kb"], queryFn: () => list() });
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <div>
      <OwnerPageHeader
        title="Customer Knowledge Base"
        description="Everything the public customer agent is allowed to say. Never add private business or customer data here."
      />

      <div className="mb-4">
        <Button size="sm" onClick={() => setEditing({ ...BLANK })}>
          <Plus className="mr-1 h-4 w-4" /> Add entry
        </Button>
      </div>

      {editing && !editing.id ? (
        <div className="mb-4">
          <EntryForm value={editing} onDone={() => setEditing(null)} />
        </div>
      ) : null}

      <div className="space-y-3">
        {(data as any[]).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No knowledge yet. Add business info, features, pricing, FAQs and policies so the customer agent can help.
            </CardContent>
          </Card>
        ) : (
          (data as any[]).map((e) =>
            editing?.id === e.id ? (
              <EntryForm key={e.id} value={editing} onDone={() => setEditing(null)} />
            ) : (
              <Card key={e.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                        {CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}
                      </span>
                      <span className="font-medium">{e.title}</span>
                      {!e.published ? (
                        <span className="text-[11px] text-muted-foreground">(hidden)</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.body}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        id: e.id,
                        category: e.category,
                        title: e.title,
                        body: e.body ?? "",
                        published: e.published,
                        sort_order: e.sort_order ?? 0,
                      })
                    }
                  >
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ),
          )
        )}
      </div>
    </div>
  );
}
