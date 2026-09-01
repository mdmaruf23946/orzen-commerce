// Section-based content editors for the Landing Page Creator.
// Merchants edit content + supported media only — no colors, fonts, sizes,
// layout or drag & drop. The design stays system-owned.
import { useState } from "react";
import {
  ArrowLeft, Award, Check, ChevronRight, Clock, Gift, Heart, Package, Plus,
  Shield, Sparkles, Star, ThumbsUp, Trash2, Truck, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  FEATURE_ICONS, MAX_KEY_POINTS, lpImage,
  type LandingContent, type LandingStoreInfo,
} from "@/lib/landing-builder";
import { librarySectionKeys, sectionSpec, usedSectionKeys } from "@/lib/landing-sections";

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

export const ICON_MAP: Record<string, typeof Check> = {
  check: Check, star: Star, shield: Shield, truck: Truck, zap: Zap, heart: Heart,
  award: Award, clock: Clock, gift: Gift, "thumbs-up": ThumbsUp, package: Package,
  sparkles: Sparkles,
};

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

/** Logo control for this landing page only: upload or remove. "" = no logo. */
function LogoField({
  label, value, onChange, storeId, hint, square = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  storeId?: string;
  hint?: string;
  square?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <div
          className={`grid h-16 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted ${
            square ? "w-16" : "w-28"
          }`}
        >
          {value ? (
            <img src={lpImage(value)} alt="" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <span className="text-[10px] text-muted-foreground">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <ImageUploader
            storeId={storeId}
            folder={storeId ? `${storeId}/landing` : undefined}
            value={value || null}
            onChange={(p) => onChange(p ?? "")}
            label={value ? "Change logo" : "Upload logo"}
          />
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Simple media control: current media → Change → Remove, with optional gallery picks. */
function MediaField({
  label, value, onChange, choices = [], storeId, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices?: string[];
  storeId?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={lpImage(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted-foreground">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <ImageUploader
            storeId={storeId}
            folder={storeId ? `${storeId}/landing` : undefined}
            value={value || null}
            onChange={(p) => onChange(p ?? "")}
            label="Change image"
          />
        </div>
      </div>
      {choices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Or choose from the product images:</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((img) => (
              <button
                key={img}
                type="button"
                onClick={() => onChange(img)}
                className={`h-14 w-14 overflow-hidden rounded-md border-2 ${
                  value === img ? "border-primary" : "border-transparent"
                }`}
              >
                <img src={lpImage(img)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const Active = ICON_MAP[value] ?? Check;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-md border bg-muted">
          <Active className="h-4 w-4" />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          Change icon
        </Button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2 rounded-lg border p-2">
          {FEATURE_ICONS.map((name) => {
            const Ico = ICON_MAP[name] ?? Check;
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                onClick={() => { onChange(name); setOpen(false); }}
                className={`grid h-9 w-9 place-items-center rounded-md border ${
                  value === name ? "border-primary bg-accent" : ""
                }`}
              >
                <Ico className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}
    </div>
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

/* ---------------- used sections + section library ---------------- */

export function SectionList({
  content, onOpen, onAdd, onRemove,
}: {
  content: LandingContent;
  onOpen: (key: string) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const used = usedSectionKeys(content.sectionOrder, content.sectionEnabled);
  const library = librarySectionKeys(content.sectionOrder, content.sectionEnabled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Used sections</h2>
        <p className="text-xs text-muted-foreground">
          These sections appear on your landing page, in this order.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {used.map((key) => {
            const spec = sectionSpec(key)!;
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:bg-accent"
              >
                <button type="button" onClick={() => onOpen(key)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{spec.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        spec.required
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      {spec.required ? "Always visible" : "Visible"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{spec.description}</div>
                </button>
                {!spec.required && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onRemove(key)}
                  >
                    Remove
                  </Button>
                )}
                <button type="button" onClick={() => onOpen(key)} aria-label={`Edit ${spec.name}`}>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">Section library</h2>
        <p className="text-xs text-muted-foreground">
          Available sections you can add to this page. Design stays automatic.
        </p>
        {library.length === 0 ? (
          <p className="mt-3 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
            Every available section is already used on this page.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {library.map((key) => {
              const spec = sectionSpec(key)!;
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{spec.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{spec.description}</div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onAdd(key)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              );
            })}
          </div>
        )}
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
  /** Store branding + contact defaults from Store Settings. */
  store?: LandingStoreInfo | null;
  /** Existing images of the linked product. */
  productImages?: string[];
};

export function HeaderEditor({ content, patch, onBack, onSave, saving, store }: EditorProps) {
  return (
    <SectionShell name="Header" onBack={onBack} onSave={onSave} saving={saving}>
      <LogoField
        label="Icon logo"
        square
        value={content.header.iconLogo}
        onChange={(v) => patch("header", { iconLogo: v })}
        storeId={store?.id ?? ""}
        hint="Square brand mark shown at the left of the header."
      />
      <LogoField
        label="Name logo (wordmark)"
        value={content.header.nameLogo}
        onChange={(v) => patch("header", { nameLogo: v })}
        storeId={store?.id ?? ""}
        hint="Image of your store name. Leave empty to show the store name as text."
      />
      <Field
        label="Store name"
        value={content.header.storeName}
        placeholder={store?.name || "Your Store Name"}
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
      <AutoNote>The logo is displayed automatically in the fixed header design. Header is always visible.</AutoNote>
    </SectionShell>
  );
}

export function HeroEditor({ content, patch, onBack, onSave, saving, store, productImages = [] }: EditorProps) {
  return (
    <SectionShell name="Hero" onBack={onBack} onSave={onSave} saving={saving}>
      <Field label="Headline" value={content.hero.headline} onChange={(v) => patch("hero", { headline: v })} />
      <Area label="Short description" value={content.hero.subheadline} onChange={(v) => patch("hero", { subheadline: v })} />
      <Field label="Offer text" value={content.hero.offerText} placeholder="Special Offer" onChange={(v) => patch("hero", { offerText: v })} />
      <Field label="Button text" value={content.hero.ctaText} placeholder="Order Now" onChange={(v) => patch("hero", { ctaText: v })} />
      <MediaField
        label="Hero product image"
        value={content.hero.image}
        onChange={(v) => patch("hero", { image: v })}
        choices={productImages}
        storeId={store?.id ?? ""}
      />
      <AutoNote>Product name, price, original price, discount and rating come automatically from the selected product.</AutoNote>
    </SectionShell>
  );
}

export function ProductEditor({ content, patch, onBack, onSave, saving, productImages = [] }: EditorProps) {
  const all = productImages.length ? productImages : content.product.images;
  const selected = content.product.selectedImages;
  const isOn = (img: string) => selected.length === 0 || selected.includes(img);
  function toggleImage(img: string) {
    const base = selected.length === 0 ? all : selected;
    const next = base.includes(img) ? base.filter((i) => i !== img) : [...base, img];
    patch("product", { selectedImages: next.length === all.length ? [] : next });
  }
  return (
    <SectionShell name="Product" onBack={onBack} onSave={onSave} saving={saving}>
      <Toggle label="Show this section" checked={content.product.enabled} onChange={(v) => patch("product", { enabled: v })} />
      <Field label="Section title" value={content.product.title} placeholder="Product Details" onChange={(v) => patch("product", { title: v })} />
      <Area label="Short description" value={content.product.subtitle} onChange={(v) => patch("product", { subtitle: v })} />

      {all.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Product images</Label>
          <div className="flex flex-wrap gap-2">
            {all.map((img) => (
              <button
                key={img}
                type="button"
                onClick={() => toggleImage(img)}
                className={`relative h-16 w-16 overflow-hidden rounded-md border-2 ${
                  isOn(img) ? "border-primary" : "border-transparent opacity-40"
                }`}
              >
                <img src={lpImage(img)} alt="" className="h-full w-full object-cover" />
                {isOn(img) && (
                  <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Tap an image to show or hide it on the landing page.</p>
        </div>
      )}

      <Toggle label="Show product features" checked={content.product.showFeatures} onChange={(v) => patch("product", { showFeatures: v })} />
      <Toggle label="Show specifications" checked={content.product.showSpecs} onChange={(v) => patch("product", { showSpecs: v })} />
      <AutoNote>Product name, images, price, features and specifications come automatically from your Product system.</AutoNote>
    </SectionShell>
  );
}

export function DescriptionEditor({ content, patch, onBack, onSave, saving }: EditorProps) {
  const points = content.description.points;
  function update(i: number, next: { title: string; text: string; icon: string }) {
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
            <IconPicker value={p.icon} onChange={(icon) => update(i, { ...p, icon })} />
            <Input placeholder="Title" value={p.title} onChange={(e) => update(i, { ...p, title: e.target.value })} />
            <Input placeholder="Description" value={p.text} onChange={(e) => update(i, { ...p, text: e.target.value })} />
          </div>
        ))}
        {points.length < MAX_KEY_POINTS && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => patch("description", { points: [...points, { title: "", text: "", icon: "check" }] })}
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

export function ReviewsEditor({ content, patch, onBack, onSave, saving, store }: EditorProps) {
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
          <MediaField
            label="Customer photo"
            value={item.photo}
            onChange={(v) => set({ photo: v })}
            storeId={store?.id ?? ""}
            hint="Optional. The photo uses the fixed review layout automatically."
          />
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
            patch("reviews", { items: [...items, { name: "", location: "", rating: 5, text: "", photo: "" }] });
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

export function FooterEditor({ content, patch, onBack, onSave, saving, store }: EditorProps) {
  const f = content.footer;
  const links = f.links;
  function setLink(i: number, next: { label: string; url: string }) {
    const list = [...links];
    list[i] = next;
    patch("footer", { links: list });
  }
  return (
    <SectionShell name="Footer" onBack={onBack} onSave={onSave} saving={saving}>
      <LogoField
        label="Icon logo"
        square
        value={f.iconLogo}
        onChange={(v) => patch("footer", { iconLogo: v })}
        storeId={store?.id ?? ""}
        hint="Square brand mark shown in the footer."
      />
      <LogoField
        label="Name logo (wordmark)"
        value={f.nameLogo}
        onChange={(v) => patch("footer", { nameLogo: v })}
        storeId={store?.id ?? ""}
        hint="Image of your store name. Leave empty to show the store name as text."
      />
      <Field
        label="Store name"
        value={f.storeName}
        placeholder={store?.name || "Your Store"}
        onChange={(v) => patch("footer", { storeName: v })}
        hint="Leave empty to use your store name."
      />
      <Area label="Short description" value={f.text} placeholder="Quality products delivered to your doorstep." onChange={(v) => patch("footer", { text: v })} />
      <Field label="Contact text" value={f.contactText} placeholder="Need help? Contact us anytime." onChange={(v) => patch("footer", { contactText: v })} />

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold">Contact information</p>
        <Field label="Phone number" value={f.phone} placeholder={store?.phone || "Phone from Store Settings"} onChange={(v) => patch("footer", { phone: v })} />
        <Field label="Email" value={f.email} placeholder={store?.email || "Email from Store Settings"} onChange={(v) => patch("footer", { email: v })} />
        <Area label="Address" rows={2} value={f.address} placeholder={store?.address || "Address from Store Settings"} onChange={(v) => patch("footer", { address: v })} />
        <Field label="Business hours" value={f.hours} placeholder="Sat–Thu, 10am – 8pm" onChange={(v) => patch("footer", { hours: v })} />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold">Social media</p>
        <Field label="Facebook" value={f.facebook} placeholder={store?.facebook || "https://facebook.com/..."} onChange={(v) => patch("footer", { facebook: v })} />
        <Field label="Instagram" value={f.instagram} placeholder={store?.instagram || "https://instagram.com/..."} onChange={(v) => patch("footer", { instagram: v })} />
        <Field label="YouTube" value={f.youtube} placeholder={store?.youtube || "https://youtube.com/..."} onChange={(v) => patch("footer", { youtube: v })} />
        <Field label="TikTok" value={f.tiktok} placeholder={store?.tiktok || "https://tiktok.com/@..."} onChange={(v) => patch("footer", { tiktok: v })} />
        <Field label="WhatsApp" value={f.whatsapp} placeholder={store?.whatsapp || "WhatsApp number or link"} onChange={(v) => patch("footer", { whatsapp: v })} />
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-semibold">Important links</p>
        {links.map((l, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Input placeholder="Label (e.g. Refund policy)" value={l.label} onChange={(e) => setLink(i, { ...l, label: e.target.value })} />
              <Input placeholder="https://…" value={l.url} onChange={(e) => setLink(i, { ...l, url: e.target.value })} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 px-2"
              onClick={() => patch("footer", { links: links.filter((_, x) => x !== i) })}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        ))}
        {links.length < 6 && (
          <Button type="button" size="sm" variant="outline" onClick={() => patch("footer", { links: [...links, { label: "", url: "" }] })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add link
          </Button>
        )}
      </div>

      <Field label="Copyright text" value={f.copyright} placeholder={`© ${new Date().getFullYear()} Your Store. All rights reserved.`} onChange={(v) => patch("footer", { copyright: v })} />
      <AutoNote>Leave contact, social or logo fields empty to use the values from Store Settings automatically.</AutoNote>
    </SectionShell>
  );
}
