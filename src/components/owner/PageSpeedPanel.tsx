import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gauge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLATFORM_ORIGIN } from "@/lib/seo";
import { runPageSpeed } from "@/lib/pagespeed.functions";

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
  return (
    <section className="min-w-0 space-y-2 break-words rounded-xl border bg-card p-3 sm:p-5">
      <h2 className="text-lg font-semibold">Google Search Console</h2>
      <p className="text-sm text-muted-foreground">
        এখনো সংযুক্ত নয় — তাই এখানে কোনো ক্লিক/ইমপ্রেশন দেখানো হচ্ছে না (বানানো ডেটা দেখানো হয় না)।
        সংযুক্ত করতে: search.google.com/search-console-এ গিয়ে <b>orzen.top</b> ডোমেন প্রপার্টি যোগ করুন এবং Google যে DNS TXT রেকর্ড দেয় সেটি Cloudflare DNS-এ বসান।
        তারপর আমাকে বললে আসল ডেটা এখানে যুক্ত করে দেব। Sitemap: <b>{PLATFORM_ORIGIN}/sitemap.xml</b>
      </p>
    </section>
  );
}
