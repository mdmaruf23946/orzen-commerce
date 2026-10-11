import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestProductSeo } from "@/lib/merchant-seo.functions";

type Draft = { title: string; description: string; keywords: string; alt: string };

export function SeoSuggestButton(props: {
  name: string;
  brand: string;
  category: string;
  description: string;
  onApply: (d: Draft) => void;
}) {
  const run = useServerFn(suggestProductSeo);
  const [loading, setLoading] = useState(false);
  async function go() {
    if (!props.name.trim()) return toast.error("আগে প্রোডাক্টের নাম লিখুন");
    setLoading(true);
    try {
      const d = await run({
        data: {
          name: props.name,
          brand: props.brand || undefined,
          category: props.category || undefined,
          description: props.description.slice(0, 6000) || undefined,
        },
      });
      props.onApply(d);
      toast.success("AI সাজেশন বসানো হয়েছে — দেখে নিয়ে Save করুন");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={go} disabled={loading} className="w-full">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
      {loading ? "AI লিখছে…" : "AI দিয়ে Title, Description, Keywords ও Alt সাজেস্ট করুন"}
    </Button>
  );
}
