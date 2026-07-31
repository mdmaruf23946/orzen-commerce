import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GripVertical, Lock, Unlock } from "lucide-react";
import { ownerSaveTheme } from "@/lib/themes.functions";
import {
  ANIMATIONS,
  ANIMATION_LEVELS,
  BADGE_STYLES,
  BANNER_STYLES,
  BUTTON_STYLES,
  CARD_KEYS,
  CARD_LABELS,
  CARD_STYLES,
  COLOR_KEYS,
  COLOR_LABELS,
  DEFAULT_THEME,
  FONT_OPTIONS,
  FONT_WEIGHTS,
  FOOTER_LAYOUTS,
  HEADER_CART_POS,
  HEADER_KEYS,
  HEADER_LABELS,
  HEADER_SEARCH_POS,
  HOVER_EFFECTS,
  IMAGE_RATIOS,
  LOGO_ALIGNS,
  MENU_STYLES,
  PRESET_LABELS,
  PRICE_STYLES,
  RATING_STYLES,
  SECTION_KEYS,
  SECTION_LABELS,
  SHADOW_LEVELS,
  STYLE_PRESETS,
  TEXT_ALIGNS,
  THEME_CATEGORIES,
  mergeTheme,
  themeCssVars,
  type SectionKey,
  type ThemeDefinition,
} from "@/lib/theme/definition";
import { ColorField, SelectField, SliderField, SwitchRow } from "@/components/admin/theme/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export type OwnerThemeRow = {
  id?: string;
  name?: string;
  slug?: string;
  category?: string;
  description?: string | null;
  preview_url?: string | null;
  status?: "draft" | "published" | "hidden";
  sort_order?: number;
  definition?: unknown;
  locked?: Record<string, unknown> | null;
};

const LOCK_GROUPS: { key: string; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "header", label: "Header" },
  { key: "nav", label: "Navigation" },
  { key: "hero", label: "Hero" },
  { key: "sections", label: "Sections" },
  { key: "section_order", label: "Section order" },
  { key: "product_card", label: "Product card" },
  { key: "buttons", label: "Buttons" },
  { key: "spacing", label: "Spacing" },
  { key: "global", label: "Radius / Shadow / Animation" },
  { key: "animation", label: "Animation style" },
  { key: "footer", label: "Footer" },
];

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function ThemeEditorDrawer({
  open,
  theme,
  onOpenChange,
}: {
  open: boolean;
  theme: OwnerThemeRow | null;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(ownerSaveTheme);

  const [meta, setMeta] = useState({
    name: "",
    slug: "",
    category: THEME_CATEGORIES[0] as string,
    description: "",
    preview_url: "",
    status: "draft" as "draft" | "published" | "hidden",
    sort_order: 0,
  });
  const [def, setDef] = useState<ThemeDefinition>(DEFAULT_THEME);
  const [locks, setLocks] = useState<Record<string, unknown>>({});
  const [touchedSlug, setTouchedSlug] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouchedSlug(!!theme?.id);
    setMeta({
      name: theme?.name ?? "",
      slug: theme?.slug ?? "",
      category: (theme?.category as string) ?? THEME_CATEGORIES[0],
      description: theme?.description ?? "",
      preview_url: theme?.preview_url ?? "",
      status: theme?.status ?? "draft",
      sort_order: theme?.sort_order ?? 0,
    });
    setDef(mergeTheme(theme?.definition ?? {}, {}));
    setLocks((theme?.locked as Record<string, unknown>) ?? {});
  }, [open, theme]);

  const set = <K extends keyof ThemeDefinition>(group: K, patch: Partial<ThemeDefinition[K]>) =>
    setDef((p) => ({ ...p, [group]: { ...(p[group] as any), ...(patch as any) } }));

  const applyPreset = (name: string) => {
    const preset = STYLE_PRESETS[name];
    if (!preset) return;
    setDef((p) => {
      const next: any = { ...p };
      for (const [g, v] of Object.entries(preset)) next[g] = { ...(next[g] as any), ...(v as any) };
      return next;
    });
    toast.success(`${PRESET_LABELS[name] ?? name} preset applied`);
  };

  const toggleLock = (key: string, locked: boolean) =>
    setLocks((p) => {
      const next = { ...p };
      if (locked) next[key] = true;
      else delete next[key];
      return next;
    });

  const moveSection = (key: SectionKey, dir: -1 | 1) => {
    setDef((p) => {
      const order = [...p.section_order];
      const i = order.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return p;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...p, section_order: order };
    });
  };

  const save = useMutation({
    mutationFn: (status?: "draft" | "published" | "hidden") =>
      saveFn({
        data: {
          ...(theme?.id ? { id: theme.id } : {}),
          name: meta.name.trim(),
          slug: (meta.slug || slugify(meta.name)).trim(),
          category: meta.category as any,
          description: meta.description.trim() || null,
          preview_url: meta.preview_url.trim() || null,
          status: status ?? meta.status,
          sort_order: Number(meta.sort_order) || 0,
          definition: def as any,
          locked: locks,
        },
      }),
    onSuccess: (_r, status) => {
      toast.success(status === "published" ? "Theme published" : "Theme saved");
      qc.invalidateQueries({ queryKey: ["owner", "themes"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const previewVars = useMemo(() => themeCssVars(def) as React.CSSProperties, [def]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{theme?.id ? "Edit theme" : "New theme"}</SheetTitle>
          <SheetDescription>
            Author the full design token set. Locked groups can never be changed by store admins.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Swatch preview */}
          <div className="mb-4 overflow-hidden rounded-xl border" style={previewVars}>
            <div className="flex h-14">
              <span className="w-1/5" style={{ background: def.colors.header }} />
              <span className="w-1/5" style={{ background: def.colors.primary }} />
              <span className="w-1/5" style={{ background: def.colors.accent }} />
              <span className="w-1/5" style={{ background: def.colors.surface }} />
              <span className="w-1/5" style={{ background: def.colors.footer }} />
            </div>
            <div className="flex items-center gap-2 p-3" style={{ background: def.colors.background }}>
              <span
                className="px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: def.colors.button,
                  color: "#fff",
                  borderRadius: def.buttons.radius,
                  fontFamily: def.typography.button_font,
                }}
              >
                Buy now
              </span>
              <span
                className="px-3 py-1.5 text-xs"
                style={{
                  border: `1px solid ${def.colors.border}`,
                  background: def.colors.card,
                  borderRadius: def.product_card.radius,
                  fontFamily: def.typography.body_font,
                }}
              >
                Product card
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Theme name</Label>
              <Input
                value={meta.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setMeta((m) => ({ ...m, name, slug: touchedSlug ? m.slug : slugify(name) }));
                }}
                placeholder="Modern Commerce"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={meta.slug}
                onChange={(e) => { setTouchedSlug(true); setMeta((m) => ({ ...m, slug: slugify(e.target.value) })); }}
                placeholder="modern-commerce"
              />
            </div>
            <SelectField
              label="Category"
              value={meta.category}
              options={THEME_CATEGORIES}
              onChange={(v) => setMeta((m) => ({ ...m, category: v }))}
            />
            <SelectField
              label="Status"
              value={meta.status}
              options={["draft", "published", "hidden"]}
              onChange={(v) => setMeta((m) => ({ ...m, status: v as any }))}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={meta.sort_order}
                onChange={(e) => setMeta((m) => ({ ...m, sort_order: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preview URL</Label>
              <Input
                value={meta.preview_url}
                onChange={(e) => setMeta((m) => ({ ...m, preview_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={meta.description}
                onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                placeholder="Short description shown in the store admin catalog"
              />
            </div>
          </div>

          {/* Presets */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.keys(STYLE_PRESETS).map((k) => (
              <Button key={k} type="button" size="sm" variant="outline" onClick={() => applyPreset(k)}>
                {PRESET_LABELS[k] ?? k}
              </Button>
            ))}
          </div>

          <Accordion type="multiple" className="mt-4">
            <AccordionItem value="colors">
              <AccordionTrigger className="text-sm">Colors</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLOR_KEYS.map((k) => (
                    <ColorField
                      key={k}
                      label={COLOR_LABELS[k]}
                      value={def.colors[k]}
                      onChange={(v) => set("colors", { [k]: v } as any)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="typography">
              <AccordionTrigger className="text-sm">Typography</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Heading font" value={def.typography.heading_font} options={FONT_OPTIONS}
                    onChange={(v) => set("typography", { heading_font: v })} />
                  <SelectField label="Body font" value={def.typography.body_font} options={FONT_OPTIONS}
                    onChange={(v) => set("typography", { body_font: v })} />
                  <SelectField label="Button font" value={def.typography.button_font} options={FONT_OPTIONS}
                    onChange={(v) => set("typography", { button_font: v })} />
                  <SelectField label="Heading weight" value={def.typography.heading_weight} options={FONT_WEIGHTS}
                    onChange={(v) => set("typography", { heading_weight: Number(v) })} />
                  <SelectField label="Body weight" value={def.typography.body_weight} options={FONT_WEIGHTS}
                    onChange={(v) => set("typography", { body_weight: Number(v) })} />
                  <SliderField label="Base size" value={def.typography.base_size} min={12} max={20} suffix="px"
                    onChange={(v) => set("typography", { base_size: v })} />
                  <SliderField label="Letter spacing" value={def.typography.letter_spacing} min={-2} max={4} step={0.1} suffix="px"
                    onChange={(v) => set("typography", { letter_spacing: v })} />
                  <SliderField label="Line height" value={def.typography.line_height} min={1} max={2} step={0.05}
                    onChange={(v) => set("typography", { line_height: v })} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="header">
              <AccordionTrigger className="text-sm">Header &amp; navigation</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid gap-2">
                  {HEADER_KEYS.map((k) => (
                    <SwitchRow key={k} label={HEADER_LABELS[k]} checked={def.header[k]}
                      onChange={(v) => set("header", { [k]: v } as any)} />
                  ))}
                  <SwitchRow label="Sticky header" checked={def.header.sticky} onChange={(v) => set("header", { sticky: v })} />
                  <SwitchRow label="Transparent header" checked={def.header.transparent} onChange={(v) => set("header", { transparent: v })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SliderField label="Header height" value={def.header.height} min={48} max={110} suffix="px"
                    onChange={(v) => set("header", { height: v })} />
                  <SelectField label="Search position" value={def.header.search_position} options={HEADER_SEARCH_POS}
                    onChange={(v) => set("header", { search_position: v as any })} />
                  <SelectField label="Cart position" value={def.header.cart_position} options={HEADER_CART_POS}
                    onChange={(v) => set("header", { cart_position: v as any })} />
                  <SelectField label="Logo align" value={def.header.logo_align} options={LOGO_ALIGNS}
                    onChange={(v) => set("header", { logo_align: v as any })} />
                  <SelectField label="Menu style" value={def.nav.menu_style} options={MENU_STYLES}
                    onChange={(v) => set("nav", { menu_style: v as any })} />
                  <SelectField label="Category position" value={def.nav.category_position} options={["top", "sidebar"]}
                    onChange={(v) => set("nav", { category_position: v as any })} />
                </div>
                <SwitchRow label="Mega menu" checked={def.nav.mega_menu} onChange={(v) => set("nav", { mega_menu: v })} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hero">
              <AccordionTrigger className="text-sm">Hero banner</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SliderField label="Height" value={def.hero.height} min={160} max={620} suffix="px"
                    onChange={(v) => set("hero", { height: v })} />
                  <SliderField label="Radius" value={def.hero.radius} min={0} max={40} suffix="px"
                    onChange={(v) => set("hero", { radius: v })} />
                  <SliderField label="Overlay" value={def.hero.overlay} min={0} max={80} suffix="%"
                    onChange={(v) => set("hero", { overlay: v })} />
                  <SelectField label="Text align" value={def.hero.text_align} options={TEXT_ALIGNS}
                    onChange={(v) => set("hero", { text_align: v as any })} />
                  <SelectField label="CTA style" value={def.hero.cta_style} options={BUTTON_STYLES}
                    onChange={(v) => set("hero", { cta_style: v as any })} />
                  <SelectField label="Banner style" value={def.banner.style} options={BANNER_STYLES}
                    onChange={(v) => set("banner", { style: v as any })} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sections">
              <AccordionTrigger className="text-sm">Homepage sections</AccordionTrigger>
              <AccordionContent className="space-y-2">
                {def.section_order.map((k, i) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate text-sm">{SECTION_LABELS[k] ?? k}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => moveSection(k, -1)}>↑</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={i === def.section_order.length - 1} onClick={() => moveSection(k, 1)}>↓</Button>
                      <Switch checked={!!def.sections[k]} onCheckedChange={(v) => set("sections", { [k]: v } as any)} />
                    </div>
                  </div>
                ))}
                {SECTION_KEYS.filter((k) => !def.section_order.includes(k)).map((k) => (
                  <SwitchRow key={k} label={SECTION_LABELS[k] ?? k} checked={!!def.sections[k]}
                    onChange={(v) => set("sections", { [k]: v } as any)} />
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="card">
              <AccordionTrigger className="text-sm">Product card</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid gap-2">
                  {CARD_KEYS.map((k) => (
                    <SwitchRow key={k} label={CARD_LABELS[k]} checked={def.product_card[k]}
                      onChange={(v) => set("product_card", { [k]: v } as any)} />
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Card style" value={def.product_card.style} options={CARD_STYLES}
                    onChange={(v) => set("product_card", { style: v as any })} />
                  <SelectField label="Shadow" value={def.product_card.shadow} options={SHADOW_LEVELS}
                    onChange={(v) => set("product_card", { shadow: v as any })} />
                  <SliderField label="Radius" value={def.product_card.radius} min={0} max={30} suffix="px"
                    onChange={(v) => set("product_card", { radius: v })} />
                  <SelectField label="Image ratio" value={def.product_card.image_ratio} options={IMAGE_RATIOS}
                    onChange={(v) => set("product_card", { image_ratio: v as any })} />
                  <SelectField label="Hover effect" value={def.product_card.hover} options={HOVER_EFFECTS}
                    onChange={(v) => set("product_card", { hover: v as any })} />
                  <SelectField label="Badge style" value={def.product_card.badge_style} options={BADGE_STYLES}
                    onChange={(v) => set("product_card", { badge_style: v as any })} />
                  <SelectField label="Button style" value={def.product_card.button_style} options={BUTTON_STYLES}
                    onChange={(v) => set("product_card", { button_style: v as any })} />
                  <SelectField label="Rating style" value={def.product_card.rating_style} options={RATING_STYLES}
                    onChange={(v) => set("product_card", { rating_style: v as any })} />
                  <SelectField label="Price style" value={def.product_card.price_style} options={PRICE_STYLES}
                    onChange={(v) => set("product_card", { price_style: v as any })} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="buttons">
              <AccordionTrigger className="text-sm">Buttons, spacing &amp; global</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Button style" value={def.buttons.style} options={BUTTON_STYLES}
                    onChange={(v) => set("buttons", { style: v as any })} />
                  <SliderField label="Button radius" value={def.buttons.radius} min={0} max={40} suffix="px"
                    onChange={(v) => set("buttons", { radius: v })} />
                  <ColorField label="Button hover color" value={def.buttons.hover_color}
                    onChange={(v) => set("buttons", { hover_color: v })} />
                  <SliderField label="Button border" value={def.buttons.border} min={0} max={4} suffix="px"
                    onChange={(v) => set("buttons", { border: v })} />
                  <SelectField label="Button shadow" value={def.buttons.shadow} options={SHADOW_LEVELS}
                    onChange={(v) => set("buttons", { shadow: v as any })} />
                  <SelectField label="Button hover" value={def.buttons.hover_animation} options={HOVER_EFFECTS}
                    onChange={(v) => set("buttons", { hover_animation: v as any })} />
                  <SliderField label="Container width" value={def.spacing.container} min={960} max={1600} step={20} suffix="px"
                    onChange={(v) => set("spacing", { container: v })} />
                  <SliderField label="Section gap" value={def.spacing.section_gap} min={8} max={96} suffix="px"
                    onChange={(v) => set("spacing", { section_gap: v })} />
                  <SliderField label="Card gap" value={def.spacing.card_gap} min={4} max={48} suffix="px"
                    onChange={(v) => set("spacing", { card_gap: v })} />
                  <SliderField label="Padding" value={def.spacing.padding} min={4} max={48} suffix="px"
                    onChange={(v) => set("spacing", { padding: v })} />
                  <SliderField label="Global radius" value={def.global.radius} min={0} max={30} suffix="px"
                    onChange={(v) => set("global", { radius: v })} />
                  <SelectField label="Global shadow" value={def.global.shadow} options={SHADOW_LEVELS}
                    onChange={(v) => set("global", { shadow: v as any })} />
                  <SelectField label="Animation level" value={def.global.animation_level} options={ANIMATION_LEVELS}
                    onChange={(v) => set("global", { animation_level: v as any })} />
                  <SelectField label="Animation style" value={def.animation} options={ANIMATIONS}
                    onChange={(v) => setDef((p) => ({ ...p, animation: v as any }))} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="footer">
              <AccordionTrigger className="text-sm">Footer</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SelectField label="Layout" value={def.footer.layout} options={FOOTER_LAYOUTS}
                  onChange={(v) => set("footer", { layout: v as any })} />
                <SwitchRow label="Social icons" checked={!!def.footer.social} onChange={(v) => set("footer", { social: v })} />
                <SwitchRow label="Copyright line" checked={def.footer.copyright} onChange={(v) => set("footer", { copyright: v })} />
                <SwitchRow label="Payment icons" checked={def.footer.payment_icons} onChange={(v) => set("footer", { payment_icons: v })} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="locks">
              <AccordionTrigger className="text-sm">Store admin locks</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Locked groups are re-sanitized server-side, so store admins can never override them.
                </p>
                {LOCK_GROUPS.map((g) => {
                  const locked = locks[g.key] === true || Array.isArray(locks[g.key]);
                  return (
                    <div key={g.key} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{g.label}</span>
                      </span>
                      <Switch checked={locked} onCheckedChange={(v) => toggleLock(g.key, v)} />
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t p-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button
            variant="outline"
            disabled={save.isPending || meta.name.trim().length < 2}
            onClick={() => save.mutate(undefined)}
          >
            Save
          </Button>
          <Button
            disabled={save.isPending || meta.name.trim().length < 2}
            onClick={() => save.mutate("published")}
          >
            Publish
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
