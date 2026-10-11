import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Search, Sparkles, XCircle } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PLATFORM_ORIGIN } from "@/lib/seo";
import { PageSpeedPanel, SearchConsoleCard } from "@/components/owner/PageSpeedPanel";
import {
  PLATFORM_PAGES, effectiveSeo, scorePageSeo, type PageSeo, type PlatformPageKey,
} from "@/lib/platform-seo-pages";
import {
  generatePlatformSeoDraft, getPlatformSeoAdmin, savePlatformPageSeo,
} from "@/lib/platform-seo-pages.functions";

export const Route = createFileRoute("/_authenticated/owner/seo")({
  component: OwnerSeoPage,
  head: () => ({
    meta: [
      { title: "Platform SEO — ORZEN Winner Admin" },
      { name: "description", content: "ORZEN প্ল্যাটফর্ম পেজগুলোর SEO হেলথ স্কোর, অডিট ও AI অপটিমাইজেশন।" },
      { property: "og:title", content: "Platform SEO — ORZEN Winner Admin" },
      { property: "og:description", content: "প্ল্যাটফর্ম পেজের SEO নিয়ন্ত্রণ করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function scoreTone(s: number) {
  return s >= 85 ? "text-green-600" : s >= 60 ? "text-amber-600" : "text-destructive";
}

function OwnerSeoPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSeoAdmin);
  const saveFn = useServerFn(savePlatformPageSeo);
  const draftFn = useServerFn(generatePlatformSeoDraft);
  const { data: overrides, isLoading } = useQuery({ queryKey: ["owner-platform-seo"], queryFn: () => getFn() });

  const [selected, setSelected] = useState<PlatformPageKey>("home");
  const [form, setForm] = useState<PageSeo>({ title: "", description: "", keywords: "" });
  const [draft, setDraft] = useState<PageSeo | null>(null);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);
  const [audited, setAudited] = useState(false);

  useEffect(() => {
    setForm(effectiveSeo(selected, overrides));
    setDraft(null);
  }, [selected, overrides]);

  const rows = useMemo(
    () => PLATFORM_PAGES.map((p) => ({ ...p, seo: effectiveSeo(p.key, overrides), ...scorePageSeo(effectiveSeo(p.key, overrides)) })),
    [overrides],
  );
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const live = scorePageSeo(form);
  const page = PLATFORM_PAGES.find((p) => p.key === selected)!;

  async function save(values: PageSeo) {
    setBusy("save");
    try {
      await saveFn({ data: { key: selected, ...values } });
      toast.success("সেভ হয়েছে — লাইভ পেজে এই SEO দেখাবে");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["owner-platform-seo"] });
    } catch (e: any) {
      toast.error(e?.message ?? "সেভ করা যায়নি");
    } finally { setBusy(null); }
  }

  async function aiDraft() {
    setBusy("ai");
    try {
      setDraft(await draftFn({ data: { key: selected, focus } }));
    } catch (e: any) {
      toast.error(e?.message ?? "AI ড্রাফট ব্যর্থ");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader title="Platform SEO" description="ORZEN-এর মূল পেজগুলোর Google-এ দেখানো টাইটেল, বিবরণ ও কিওয়ার্ড নিয়ন্ত্রণ করুন।" />
      <SearchConsoleCard />
      <PageSpeedPanel />

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">গড় SEO হেলথ স্কোর</p>
            <p className={cn("text-3xl font-bold", scoreTone(avg))}>{isLoading ? "…" : `${avg}/100`}</p>
          </div>
          <Button onClick={() => { setAudited(true); toast.success("অডিট সম্পন্ন — নিচে প্রতিটি পেজের সমস্যা দেখুন"); }}>
            <Search className="mr-2 h-4 w-4" /> Run Audit
          </Button>
        </div>
        <div className="mt-4 divide-y rounded-lg border">
          {rows.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              className={cn("flex w-full flex-col gap-1 p-3 text-left hover:bg-muted/50", selected === r.key && "bg-muted")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.label} <span className="text-xs text-muted-foreground">{r.path}</span></span>
                <span className={cn("font-semibold", scoreTone(r.score))}>{r.score}</span>
              </div>
              {audited && (r.issues.length ? (
                <ul className="space-y-0.5 text-xs">
                  {r.issues.map((i) => (
                    <li key={i.text} className="flex items-center gap-1 text-muted-foreground">
                      {i.level === "error" ? <XCircle className="h-3 w-3 text-destructive" /> : <AlertTriangle className="h-3 w-3 text-amber-600" />}
                      {i.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> কোনো সমস্যা নেই</span>
              ))}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">{page.label} পেজ এডিট</h2>
          <div className="space-y-1">
            <Label>SEO Title <span className="text-xs text-muted-foreground">({form.title.length}/60)</span></Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label>Meta Description <span className="text-xs text-muted-foreground">({form.description.length}/160)</span></Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={320} />
          </div>
          <div className="space-y-1">
            <Label>Keywords (কমা দিয়ে)</Label>
            <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} maxLength={400} />
          </div>
          <p className={cn("text-sm font-medium", scoreTone(live.score))}>এই পরিবর্তনের স্কোর: {live.score}/100</p>
          <Button onClick={() => save(form)} disabled={busy !== null}>
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>

          <div className="space-y-2 border-t pt-4">
            <Label>AI-কে কী ফোকাস করতে বলবেন? (ঐচ্ছিক)</Label>
            <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="যেমন: Facebook seller, Bangladesh online shop" maxLength={300} />
            <Button variant="secondary" onClick={aiDraft} disabled={busy !== null}>
              {busy === "ai" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              AI দিয়ে ড্রাফট করুন
            </Button>
          </div>

          {draft && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
              <p className="font-semibold">AI ড্রাফট (স্কোর {scorePageSeo(draft).score}/100)</p>
              <p><b>Title:</b> {draft.title}</p>
              <p><b>Description:</b> {draft.description}</p>
              <p><b>Keywords:</b> {draft.keywords}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setForm(draft); setDraft(null); }}>ফর্মে বসান</Button>
                <Button size="sm" onClick={() => save(draft)} disabled={busy !== null}>সরাসরি সেভ</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>বাতিল</Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Google প্রিভিউ</p>
            <div className="rounded-lg bg-background p-4">
              <p className="text-xs text-muted-foreground">{PLATFORM_ORIGIN.replace("https://", "")}{page.path === "/" ? "" : ` › ${page.path.slice(1)}`}</p>
              <p className="truncate text-lg text-primary">{form.title.length > 60 ? form.title.slice(0, 58) + "…" : form.title}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{form.description.length > 160 ? form.description.slice(0, 157) + "…" : form.description}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Facebook শেয়ার প্রিভিউ</p>
            <div className="overflow-hidden rounded-lg border">
              <img src="/og-orzen.jpg" alt="ORZEN share image" className="aspect-[1200/630] w-full object-cover" />
              <div className="bg-muted p-3">
                <p className="text-xs uppercase text-muted-foreground">orzen.top</p>
                <p className="truncate font-semibold">{form.title}</p>
                <p className="line-clamp-1 text-sm text-muted-foreground">{form.description}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
