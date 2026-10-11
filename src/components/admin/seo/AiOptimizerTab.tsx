// Merchant AI SEO optimizer: coverage audit, bulk generation and the
// side-by-side approval list. Suggestions never go live without approval.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  getSeoAudit,
  generateBulkSeo,
  approveSeoRecommendations,
  rejectSeoRecommendations,
} from "@/lib/merchant-seo.functions";

type Edit = { title: string; description: string; keywords: string; alt: string };

export function AiOptimizerTab() {
  const audit = useServerFn(getSeoAudit);
  const bulk = useServerFn(generateBulkSeo);
  const approve = useServerFn(approveSeoRecommendations);
  const reject = useServerFn(rejectSeoRecommendations);
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin", "seo-audit"], queryFn: () => audit() });
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEdits((prev) => {
      const next: Record<string, Edit> = {};
      for (const r of data.pending)
        next[r.id] = prev[r.id] ?? {
          title: r.proposed_title ?? "",
          description: r.proposed_description ?? "",
          keywords: r.proposed_keywords ?? "",
          alt: r.proposed_alt ?? "",
        };
      return next;
    });
  }, [data]);

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pct = (n: number) => (data.total ? Math.round((n / data.total) * 100) : 0);
  const score = data.total
    ? Math.round(
        (pct(data.coverage.title) * 0.3 + pct(data.coverage.description) * 0.3 + pct(data.coverage.keywords) * 0.15 + pct(data.coverage.alt) * 0.1 + pct(data.coverage.image) * 0.15),
      )
    : 0;

  async function runBulk(ids: string[]) {
    const pendingIds = new Set(data!.pending.map((p) => p.entity_id));
    const todo = ids.filter((id) => !pendingIds.has(id));
    if (!todo.length) return toast.info("সব প্রোডাক্টের সাজেশন আগেই তৈরি আছে — নিচে রিভিউ করুন।");
    setProgress({ done: 0, total: todo.length });
    let created = 0, failed = 0;
    for (let i = 0; i < todo.length; i += 5) {
      try {
        const r = await bulk({ data: { productIds: todo.slice(i, i + 5) } });
        created += r.created;
        failed += r.failed;
      } catch {
        failed += Math.min(5, todo.length - i);
      }
      setProgress({ done: Math.min(i + 5, todo.length), total: todo.length });
    }
    setProgress(null);
    await refetch();
    if (created) toast.success(`${created}টি প্রোডাক্টের সাজেশন তৈরি — রিভিউ করে Approve দিন`);
    if (failed) toast.error(`${failed}টি তৈরি করা যায়নি — পরে আবার চেষ্টা করুন`);
  }

  async function doApprove(ids: string[]) {
    setBusy(true);
    try {
      const r = await approve({ data: { items: ids.map((id) => ({ id, ...edits[id] })) } });
      toast.success(`${r.applied}টি লাইভ হয়েছে (History থেকে Restore করা যাবে)`);
      await refetch();
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doReject(ids: string[]) {
    setBusy(true);
    try {
      await reject({ data: { ids } });
      await refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    { label: "SEO title", n: data.coverage.title },
    { label: "Meta description", n: data.coverage.description },
    { label: "Keywords", n: data.coverage.keywords },
    { label: "Image alt text", n: data.coverage.alt },
    { label: "Product photo", n: data.coverage.image },
  ];

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Product SEO score</h3>
            <p className="text-xs text-muted-foreground">{data.total}টি প্রোডাক্টের উপর ভিত্তি করে</p>
          </div>
          <span className={`text-2xl font-semibold ${score >= 80 ? "text-primary" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
            {score}/100
          </span>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{r.label}</span>
                <span className="text-muted-foreground">{r.n}/{data.total}</span>
              </div>
              <Progress value={pct(r.n)} className="h-1.5" />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Bulk AI optimizer</h3>
        <p className="text-xs text-muted-foreground">
          AI সাজেশন তৈরি করবে, কিন্তু আপনি Approve না দেওয়া পর্যন্ত কিছুই লাইভ হবে না। যেসব প্রোডাক্টের সাজেশন আগেই আছে সেগুলো আবার তৈরি হবে না (খরচ বাঁচে)।
        </p>
        {progress ? (
          <div className="space-y-1">
            <Progress value={(progress.done / progress.total) * 100} />
            <p className="text-xs text-muted-foreground">{progress.done}/{progress.total} প্রসেস হয়েছে… পেজটা খোলা রাখুন</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!data.missingIds.length} onClick={() => runBulk(data.missingIds)}>
              <Sparkles className="mr-1.5 h-4 w-4" /> SEO নেই এমন {data.missingIds.length}টি
            </Button>
            <Button size="sm" variant="outline" disabled={!data.allIds.length} onClick={() => runBulk(data.allIds)}>
              সব {data.allIds.length}টি প্রোডাক্ট
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">রিভিউর অপেক্ষায় ({data.pending.length})</h3>
          {data.pending.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => doReject(data.pending.map((p) => p.id))}>
                Reject All
              </Button>
              <Button size="sm" disabled={busy} onClick={() => doApprove(data.pending.map((p) => p.id))}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Approve All
              </Button>
            </div>
          )}
        </div>
        {data.pending.length === 0 && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">কোনো সাজেশন রিভিউর অপেক্ষায় নেই।</p>
        )}
        {data.pending.map((r) => {
          const e = edits[r.id];
          if (!e) return null;
          const upd = (k: keyof Edit, v: string) => setEdits((s) => ({ ...s, [r.id]: { ...s[r.id], [k]: v } }));
          return (
            <article key={r.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                {r.image && <img src={r.image} alt="" className="h-10 w-10 rounded-md object-cover" />}
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs">
                  <p className="font-semibold text-muted-foreground">বর্তমান</p>
                  <p><span className="text-muted-foreground">Title:</span> {r.current.title || "—"}</p>
                  <p><span className="text-muted-foreground">Description:</span> {r.current.description || "—"}</p>
                  <p><span className="text-muted-foreground">Keywords:</span> {r.current.keywords || "—"}</p>
                  <p><span className="text-muted-foreground">Alt:</span> {r.current.alt || "—"}</p>
                </div>
                <div className="space-y-2 rounded-lg border border-primary/30 p-3">
                  <p className="text-xs font-semibold text-primary">AI সাজেশন (এডিট করা যাবে)</p>
                  <Input value={e.title} maxLength={70} onChange={(ev) => upd("title", ev.target.value)} />
                  <p className="text-[10px] text-muted-foreground">{e.title.length}/60</p>
                  <Textarea rows={3} value={e.description} maxLength={200} onChange={(ev) => upd("description", ev.target.value)} />
                  <p className="text-[10px] text-muted-foreground">{e.description.length}/160</p>
                  <Input value={e.keywords} placeholder="Keywords" onChange={(ev) => upd("keywords", ev.target.value)} />
                  <Input value={e.alt} placeholder="Image alt text" maxLength={200} onChange={(ev) => upd("alt", ev.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => doReject([r.id])}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button size="sm" disabled={busy} onClick={() => doApprove([r.id])}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
