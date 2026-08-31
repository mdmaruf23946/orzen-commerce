// Section-based content editors for the Landing Page Creator.
// Merchants edit text only — no colors, fonts, sizes, layout or drag & drop.
import { useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MAX_KEY_POINTS, type LandingContent } from "@/lib/landing-builder";

export type SectionKey =
  | "header" | "hero" | "product" | "description"
  | "faq" | "reviews" | "order" | "footer";

export const SECTIONS: {
  key: SectionKey;
  name: string;
  description: string;
  optional: boolean;
}[] = [
  { key: "header", name: "Header", description: "Store identity and navigation", optional: false },
  { key: "hero", name: "Hero", description: "Main product headline and offer", optional: false },
  { key: "product", name: "Product", description: "Product information and features", optional: true },
  { key: "description", name: "Description", description: "Product benefits and information", optional: true },
  { key: "faq", name: "FAQ", description: "Frequently asked questions", optional: true },
  { key: "reviews", name: "Reviews", description: "Customer reviews and ratings", optional: true },
  { key: "order", name: "Order Form", description: "Customer order information", optional: false },
  { key: "footer", name: "Footer", description: "Store information and links", optional: false },
];

export function isSectionVisible(content: LandingContent, key: SectionKey): boolean | null {
  switch (key) {
    case "product": return content.product.enabled;
    case "description": return content.description.enabled;
    case "faq": return content.faq.enabled;
    case "reviews": return content.reviews.enabled;
    default: return null;
  }
}

/* ---------------- shared primitives ---------------- */

export function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Area({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function AutoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

export function SectionShell({
  name, onBack, onSave, saving, children, extraAction,
}: {
  name: string;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
  extraAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sections
      </button>
      <h2 className="text-base font-semibold">{name}</h2>
      <div className="space-y-4 rounded-xl border bg-card p-4">{children}</div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {extraAction}
      </div>
    </div>
  );
}

export function ItemRow({ label, sub, onOpen }: { label: string; sub?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left hover:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/* ---------------- section list ---------------- */

export function SectionList({
  content, onOpen,
}: {
  content: LandingContent;
  onOpen: (key: SectionKey) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Content</h2>
        <p className="text-xs text-muted-foreground">Manage your landing page sections.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const visible = isSectionVisible(content, s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onOpen(s.key)}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  {visible === null ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      Always visible
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        visible
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {visible ? "Visible" : "Hidden"}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- individual editors ---------------- */

type EditorProps = {
  content: LandingContent;
  patch: <K extends keyof LandingContent>(key: K, value: Partial<LandingContent[K]>) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
};

export function HeaderEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  return (
    <SectionShell name="Header" onBack={onBack} onSave={onSave} saving={saving}>
      <Field
        label="Store name"
        value={content.header.storeName}
        placeholder="Your Store Name"
        onChange={(v) => patch("header", { storeName: v })}
        hint="Leave empty to use your store name from Store Settings."
      />
      <Field
        label="Header button text"
        value={content.header.buttonText}
        placeholder="Order Now"
        onChange={(v) => patch("header", { buttonText: v })}
      />
      <Toggle
        label="Show order button"
        checked={content.header.showButton}
        onChange={(v) => patch("header", { showButton: v })}
      />
      <AutoNote>Your store logo comes automatically from Store Settings. Header design is fixed and always visible.</AutoNote>
    </SectionShell>
  );
}

export function HeroEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  return (
    <SectionShell name="Hero" onBack={onBack} onSave={onSave} saving={saving}>
      <Field label="Headline" value={content.hero.headline} onChange={(v) => patch("hero", { headline: v })} />
      <Area label="Short description" value={content.hero.subheadline} onChange={(v) => patch("hero", { subheadline: v })} />
      <Field label="Offer text" value={content.hero.offerText} placeholder="Special Offer" onChange={(v) => patch("hero", { offerText: v })} />
      <Field label="Button text" value={content.hero.ctaText} placeholder="Order Now" onChange={(v) => patch("hero", { ctaText: v })} />
      <AutoNote>Product image, name, price, original price, discount and rating come automatically from the selected product.</AutoNote>
    </SectionShell>
  );
}

export function ProductEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  return (
    <SectionShell name="Product" onBack={onBack} onSave={onSave} saving={saving}>
      <Toggle label="Show this section" checked={content.product.enabled} onChange={(v) => patch("product", { enabled: v })} />
      <Field label="Section title" value={content.product.title} placeholder="Product Details" onChange={(v) => patch("product", { title: v })} />
      <Area label="Short description" value={content.product.subtitle} onChange={(v) => patch("product", { subtitle: v })} />
      <Toggle label="Show product features" checked={content.product.showFeatures} onChange={(v) => patch("product", { showFeatures: v })} />
      <AutoNote>Product name, images, price, features and specifications come automatically from your Product system.</AutoNote>
    </SectionShell>
  );
}

export function DescriptionEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  const points = content.description.points;
  function update(i: number, next: { title: string; text: string }) {
    const list = [...points];
    list[i] = next;
    patch("description", { points: list });
  }
  return (
    <SectionShell name="Description" onBack={onBack} onSave={onSave} saving={saving}>
      <Toggle label="Show this section" checked={content.description.enabled} onChange={(v) => patch("description", { enabled: v })} />
      <Field label="Section title" value={content.description.title} placeholder="Why Choose This Product?" onChange={(v) => patch("description", { title: v })} />
      <Area label="Description" rows={4} value={content.description.text} onChange={(v) => patch("description", { text: v })} />

      <div className="space-y-3">
        {points.map((p, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Key point {i + 1}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2"
                onClick={() => patch("description", { points: points.filter((_, x) => x !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
            <Input placeholder="Title" value={p.title} onChange={(e) => update(i, { ...p, title: e.target.value })} />
            <Input placeholder="Description" value={p.text} onChange={(e) => update(i, { ...p, text: e.target.value })} />
          </div>
        ))}
        {points.length < MAX_KEY_POINTS && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => patch("description", { points: [...points, { title: "", text: "" }] })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add key point
          </Button>
        )}
      </div>
    </SectionShell>
  );
}

export function FaqEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  const [open, setOpen] = useState<number | null>(null);
  const items = content.faq.items;

  if (open !== null && items[open]) {
    const item = items[open]!;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOpen(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to FAQ
        </button>
        <h2 className="text-base font-semibold">Question {open + 1}</h2>
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field
            label="Question"
            value={item.q}
            onChange={(v) => {
              const list = [...items];
              list[open] = { ...item, q: v };
              patch("faq", { items: list });
            }}
          />
          <Area
            label="Answer"
            value={item.a}
            onChange={(v) => {
              const list = [...items];
              list[open] = { ...item, a: v };
              patch("faq", { items: list });
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { onSave(); setOpen(null); }} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              patch("faq", { items: items.filter((_, i) => i !== open) });
              setOpen(null);
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete FAQ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SectionShell name="FAQ" onBack={onBack} onSave={onSave} saving={saving}>
      <Toggle label="Show this section" checked={content.faq.enabled} onChange={(v) => patch("faq", { enabled: v })} />
      <Field label="Section title" value={content.faq.title} onChange={(v) => patch("faq", { title: v })} />
      <div className="space-y-2">
        {items.map((f, i) => (
          <ItemRow key={i} label={f.q || `Question ${i + 1}`} sub={f.a} onOpen={() => setOpen(i)} />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            patch("faq", { items: [...items, { q: "", a: "" }] });
            setOpen(items.length);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add FAQ
        </Button>
      </div>
    </SectionShell>
  );
}

export function ReviewsEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  const [open, setOpen] = useState<number | null>(null);
  const items = content.reviews.items;

  if (open !== null && items[open]) {
    const item = items[open]!;
    const set = (next: Partial<typeof item>) => {
      const list = [...items];
      list[open] = { ...item, ...next };
      patch("reviews", { items: list });
    };
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOpen(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Reviews
        </button>
        <h2 className="text-base font-semibold">Review {open + 1}</h2>
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <Field label="Customer name" value={item.name} onChange={(v) => set({ name: v })} />
          <Field label="Customer location" value={item.location} onChange={(v) => set({ location: v })} />
          <Area label="Review" value={item.text} onChange={(v) => set({ text: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs">Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set({ rating: n })} aria-label={`${n} star`}>
                  <Star
                    className={`h-6 w-6 ${n <= (item.rating || 5) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { onSave(); setOpen(null); }} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          <Button
            variant="outline"
            onClick={() => {
              patch("reviews", { items: items.filter((_, i) => i !== open) });
              setOpen(null);
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete review
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SectionShell name="Reviews" onBack={onBack} onSave={onSave} saving={saving}>
      <Toggle label="Show reviews" checked={content.reviews.enabled} onChange={(v) => patch("reviews", { enabled: v })} />
      <Field label="Section title" value={content.reviews.title} onChange={(v) => patch("reviews", { title: v })} />
      <div className="space-y-2">
        {items.map((r, i) => (
          <ItemRow key={i} label={r.name || `Review ${i + 1}`} sub={r.text} onOpen={() => setOpen(i)} />
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            patch("reviews", { items: [...items, { name: "", location: "", rating: 5, text: "" }] });
            setOpen(items.length);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add review
        </Button>
      </div>
    </SectionShell>
  );
}

export function OrderTextEditor({
  content, patch, onBack, onSave, saving, buttonText, onButtonText, onOpenFormTab,
}: EditorProps & {
  buttonText: string;
  onButtonText: (v: string) => void;
  onOpenFormTab: () => void;
}) {
  return (
    <SectionShell name="Order Form" onBack={onBack} onSave={onSave} saving={saving}>
      <Field label="Form title" value={content.order.title} placeholder="Order Now" onChange={(v) => patch("order", { title: v })} />
      <Area label="Form subtitle" value={content.order.subtitle} onChange={(v) => patch("order", { subtitle: v })} />
      <Field label="Button text" value={buttonText} placeholder="Confirm Order" onChange={onButtonText} />
      <Area label="Success message" value={content.order.successMessage} onChange={(v) => patch("order", { successMessage: v })} />
      <AutoNote>
        Customer fields, delivery charge, payment methods and order validation are configured in the Order form tab.
        Product, price, quantity and totals come automatically from your existing order system.
      </AutoNote>
      <Button type="button" variant="outline" size="sm" onClick={onOpenFormTab}>
        Open Order form settings
      </Button>
    </SectionShell>
  );
}

export function FooterEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  return (
    <SectionShell name="Footer" onBack={onBack} onSave={onSave} saving={saving}>
      <Area label="Short description" value={content.footer.text} placeholder="Quality products delivered to your doorstep." onChange={(v) => patch("footer", { text: v })} />
      <Field label="Contact text" value={content.footer.contactText} placeholder="Need help? Contact us anytime." onChange={(v) => patch("footer", { contactText: v })} />
      <Field label="Copyright text" value={content.footer.copyright} placeholder={`© ${new Date().getFullYear()} Your Store. All rights reserved.`} onChange={(v) => patch("footer", { copyright: v })} />
      <AutoNote>Phone, email, address and social links come automatically from Store Settings.</AutoNote>
    </SectionShell>
  );
}
