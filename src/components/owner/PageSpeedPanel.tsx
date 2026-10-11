import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gauge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLATFORM_ORIGIN } from "@/lib/seo";
import { runPageSpeed } from "@/lib/pagespeed.functions";
import { getSearchConsoleSummary } from "@/lib/search-console.functions";
import { useQuery } from "@tanstack/react-query";

type Result = Awaited<ReturnType<typeof runPageSpeed>>;
const tone = (s: number | null) => (s == null ? "" : s >= 90 ? "text-green-600" : s >= 50 ? "text-amber-600" : "text-destructive");

export function PageSpeedPanel() {
  const fn = useServerFn(runPageSpeed);
  const [url, setUrl] = useState(`${PLATFORM_ORIGIN}/`);
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);

  async function run() {
    setBusy(true);
    try { setR(await fn({ data: { url, strategy } })); }
    catch (e: any) { toast.error(e?.message ?? "পরীক্ষা ব্যর্থ"); }
    finally { setBusy(false); }
  }

  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-card p-3 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Gauge className="h-5 w-5" /> পেজ স্পিড (Google PageSpeed)</h2>
        <p className="text-sm text-muted-foreground">যেকোনো পেজের আসল স্পিড ও Core Web Vitals Google থেকে সরাসরি দেখুন। পরীক্ষায় ২০–৪০ সেকেন্ড লাগতে পারে।</p>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input className="col-span-2 min-w-0 max-w-full sm:basis-64 sm:flex-1" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button variant={strategy === "mobile" ? "default" : "outline"} onClick={() => setStrategy("mobile")}>Mobile</Button>
        <Button variant={strategy === "desktop" ? "default" : "outline"} onClick={() => setStrategy("desktop")}>Desktop</Button>
        <Button className="col-span-2" onClick={run} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}পরীক্ষা করুন</Button>
      </div>
      {r && (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Performance", r.performance], ["SEO", r.seo], ["Accessibility", r.accessibility], ["Best Practices", r.bestPractices]] as const).map(([l, v]) => (
            <div key={l} className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className={cn("text-2xl font-bold", tone(v))}>{v ?? "—"}</p>
            </div>
          ))}
          {([["LCP", r.lcp], ["FCP", r.fcp], ["CLS", r.cls], ["TBT", r.tbt]] as const).map(([l, v]) => (
            <div key={l} className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-lg font-semibold">{v ?? "—"}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SearchConsoleCard() {
  const fn = useServerFn(getSearchConsoleSummary);
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["owner-gsc"], queryFn: () => fn(), staleTime: 10 * 60 * 1000 });
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <section className="min-w-0 space-y-3 break-words rounded-xl border bg-card p-3 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Google Search Console</h2>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} রিফ্রেশ
        </Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
      : !data || data.status === "not_connected" ? <p className="text-sm text-muted-foreground">Search Console সংযুক্ত নয় — বানানো ডেটা দেখানো হয় না।</p>
      : data.status === "not_verified" ? <p className="text-sm text-muted-foreground">orzen.top এখনো যাচাই হয়নি।</p>
      : data.status === "error" ? <p className="text-sm text-destructive">ডেটা আনা যায়নি: {data.message}</p>
      : (
        <>
          <p className="text-xs text-muted-foreground">{data.siteUrl} · {data.startDate} → {data.endDate} (শেষ ২৮ দিন)</p>
          {!data.totals ? (
            <p className="text-sm text-muted-foreground">এই সময়ে Google এখনো কোনো ক্লিক/ইমপ্রেশন রিপোর্ট করেনি। নতুন যাচাই হওয়া সাইটে ডেটা আসতে কয়েক দিন লাগে।</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["ক্লিক", n(data.totals.clicks)], ["ইমপ্রেশন", n(data.totals.impressions)], ["CTR", `${(data.totals.ctr * 100).toFixed(1)}%`], ["গড় পজিশন", data.totals.position.toFixed(1)]].map(([l, v]) => (
                <div key={l} className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></div>
              ))}
            </div>
          )}
          {data.queries.length > 0 && (
            <div><p className="mb-1 text-sm font-medium">শীর্ষ সার্চ শব্দ</p>
              <ul className="divide-y rounded-lg border text-sm">{data.queries.map((r) => (
                <li key={r.keys?.[0]} className="flex justify-between gap-2 p-2"><span className="min-w-0 truncate">{r.keys?.[0]}</span><span className="shrink-0 text-muted-foreground">{r.clicks} / {r.impressions}</span></li>
              ))}</ul></div>
          )}
          {data.pages.length > 0 && (
            <div><p className="mb-1 text-sm font-medium">শীর্ষ পেজ</p>
              <ul className="divide-y rounded-lg border text-sm">{data.pages.map((r) => (
                <li key={r.keys?.[0]} className="flex justify-between gap-2 p-2"><span className="min-w-0 truncate">{r.keys?.[0]?.replace(PLATFORM_ORIGIN, "") || "/"}</span><span className="shrink-0 text-muted-foreground">{r.clicks} / {r.impressions}</span></li>
              ))}</ul></div>
          )}
          {data.sitemaps.map((s) => (
            <p key={s.path} className="text-xs text-muted-foreground">Sitemap: {s.path} — {s.lastDownloaded ? `Google পড়েছে ${s.lastDownloaded.slice(0, 10)}` : "Google এখনো পড়েনি"}{s.errors ? `, ${s.errors}টি এরর` : ""}{s.warnings ? `, ${s.warnings}টি সতর্কতা` : ""}</p>
          ))}
        </>
      )}
    </section>
  );
}
