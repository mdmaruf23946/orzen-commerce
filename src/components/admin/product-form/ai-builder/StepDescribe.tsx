// Step 3 — description prompt + media links, tuned per product type.
import { Facebook, Youtube, PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Grid } from "./ui";
import type { AiExtras, AiProductType } from "./types";

const MAX_DESC = 4000;

const PLACEHOLDER: Record<AiProductType, string> = {
  physical: `Describe your product in as much detail as possible.

Example:
Product name
Brand / model
Color · material · size
Key features
Specifications
What's in the box
Warranty
Target customer`,
  digital: `Describe your digital product in as much detail as possible.

Example:
Product name
What the buyer gets (files, formats)
Who it is for
Key features
Installation / how to use
System requirements
What changed in this version
License terms`,
  service: `Describe your service in as much detail as possible.

Example:
Service name
What is included
How you work (step by step)
What the customer must provide
Delivery timeline and revisions
Who this is for
Common questions`,
  subscription: `Describe your subscription plan in as much detail as possible.

Example:
Plan name
What subscribers unlock
Key features and benefits
Included services / limits
Who this plan is for
Renewal and cancellation terms
Common questions`,
};

const GENERATES: Record<AiProductType, string[]> = {
  physical: ["Product description", "Features", "Specifications", "What's in the box", "SEO & tags"],
  digital: ["Description", "Installation guide", "System requirements", "Changelog", "SEO & tags"],
  service: ["Service description", "Included features", "Customer requirements", "Workflow", "FAQ"],
  subscription: ["Subscription overview", "Features", "Benefits", "Included services", "FAQ"],
};

export function StepDescribe({
  productType,
  description,
  setDescription,
  extras,
  setExtras,
}: {
  productType: AiProductType;
  description: string;
  setDescription: (v: string) => void;
  extras: AiExtras;
  setExtras: <K extends keyof AiExtras>(k: K, v: AiExtras[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Tell the AI everything you know. The more detail you give, the better the result.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {GENERATES[productType].map((g) => (
            <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {g}
            </span>
          ))}
        </div>
        <Textarea
          rows={10}
          maxLength={MAX_DESC}
          placeholder={PLACEHOLDER[productType]}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="text-right text-xs text-muted-foreground">
          {description.length} / {MAX_DESC}
        </div>
      </div>

      {productType === "physical" ? (
        <Grid cols={2}>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input type="url" placeholder="https://youtube.com/watch?v=…" value={extras.youtubeUrl} onChange={(e) => setExtras("youtubeUrl", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Facebook className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Facebook video URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input type="url" placeholder="https://facebook.com/…" value={extras.facebookUrl} onChange={(e) => setExtras("facebookUrl", e.target.value)} />
          </div>
        </Grid>
      ) : productType === "digital" ? (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <PlayCircle className="h-3.5 w-3.5 text-primary" /> Demo video URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input type="url" placeholder="https://…" value={extras.demoVideoUrl} onChange={(e) => setExtras("demoVideoUrl", e.target.value)} />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <PlayCircle className="h-3.5 w-3.5 text-primary" /> Promo video URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input type="url" placeholder="https://…" value={extras.demoVideoUrl} onChange={(e) => setExtras("demoVideoUrl", e.target.value)} />
        </div>
      )}
    </div>
  );
}
