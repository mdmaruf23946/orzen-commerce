import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeoCard, SaveBar, type TabProps } from "./shared";

export function VerificationTab({ form, set, saving, onSave }: TabProps) {
  return (
    <div className="space-y-4">
      <SeoCard
        title="Site verification"
        description="Paste only the content value from the verification meta tag."
      >
        <div className="space-y-1.5">
          <Label>Google Search Console</Label>
          <Input
            value={form.google_verification ?? ""}
            placeholder="google-site-verification value"
            onChange={(e) => set("google_verification", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Bing Webmaster Tools</Label>
          <Input
            value={form.bing_verification ?? ""}
            placeholder="msvalidate.01 value"
            onChange={(e) => set("bing_verification", e.target.value)}
          />
        </div>
      </SeoCard>
      <SaveBar saving={saving} onSave={() => onSave(["google_verification", "bing_verification"])} />
    </div>
  );
}
