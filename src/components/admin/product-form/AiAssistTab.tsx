// Functional replacement for the old "AI (Coming Soon)" tab.
// Uses the existing AI Product Builder server function to draft copy/SEO for
// the product currently open in the dialog. Plan-gated server-side.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { generateProductDraft, type ProductDraft } from "@/lib/ai-product-builder.functions";

type SeoValue = { title?: string; description?: string; keywords?: string; slug?: string };

export function AiAssistTab(props: {
  productType: "physical" | "digital" | "service" | "subscription";
  name: string;
  brand: string;
  categoryName: string;
  images: string[];
  currentDescription: string;
  onApplyName: (v: string) => void;
  onApplyShortDesc: (v: string) => void;
  onApplyDescription: (v: string) => void;
  onApplySeo: (v: SeoValue) => void;
}) {
  const run = useServerFn(generateProductDraft);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  async function generate() {
    setLoading(true);
    try {
      const res = (await run({
        data: {
          imagePaths: props.images.filter(Boolean).slice(0, 8),
          description: [props.name, hint, props.currentDescription].filter(Boolean).join("\n\n").slice(0, 4000),
          productType: props.productType,
          categoryName: props.categoryName ?? "",
          subcategoryName: "",
          brand: props.brand ?? "",
          knownFacts: "",
        },
      })) as any;
      const d: ProductDraft = res?.draft ?? res;
      setDraft(d);
      setApplied({});
      toast.success("AI draft ready — নিচে থেকে apply করুন");
    } catch (e: any) {
      toast.error(e?.message ?? "AI generation failed");
    } finally {
      setLoading(false);
    }
  }

  function mark(key: string) {
    setApplied((a) => ({ ...a, [key]: true }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-3">
        <p className="text-sm font-medium">AI Assist</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Product images আর নিচের হিন্ট থেকে AI নাম, বর্ণনা এবং SEO তৈরি করবে। প্রতিটি অংশ আলাদাভাবে apply করা যাবে।
        </p>
      </div>

      <div className="space-y-2">
        <Label>Hint for the AI (optional)</Label>
        <Textarea
          rows={3}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="e.g. Premium cotton panjabi, summer collection, sizes M–XXL"
        />
      </div>

      <Button type="button" onClick={generate} disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {loading ? "Generating…" : "Generate with AI"}
      </Button>

      {draft && (
        <div className="space-y-3">
          <Block
            label="Product name"
            preview={draft.name}
            done={applied.name}
            onApply={() => {
              props.onApplyName(draft.name);
              mark("name");
            }}
          />
          <Block
            label="Short description"
            preview={draft.short_description}
            done={applied.short}
            onApply={() => {
              props.onApplyShortDesc(draft.short_description);
              mark("short");
            }}
          />
          <Block
            label="Full description"
            preview={draft.long_description_html.replace(/<[^>]+>/g, " ").slice(0, 220)}
            done={applied.long}
            onApply={() => {
              props.onApplyDescription(draft.long_description_html);
              mark("long");
            }}
          />
          <Block
            label="SEO title, description, keywords & slug"
            preview={`${draft.seo_title} — ${draft.seo_description}`}
            done={applied.seo}
            onApply={() => {
              props.onApplySeo({
                title: draft.seo_title,
                description: draft.seo_description,
                keywords: (draft.keywords ?? []).join(", "),
                slug: draft.slug_suggestion,
              });
              mark("seo");
            }}
          />
        </div>
      )}
    </div>
  );
}

function Block(props: { label: string; preview: string; done?: boolean; onApply: () => void }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium">{props.label}</p>
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{props.preview || "—"}</p>
        </div>
        <Button type="button" size="sm" variant={props.done ? "secondary" : "default"} onClick={props.onApply}>
          {props.done ? <Check className="h-4 w-4" /> : "Apply"}
        </Button>
      </div>
    </div>
  );
}
