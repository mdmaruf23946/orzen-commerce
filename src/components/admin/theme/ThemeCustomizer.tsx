import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  GripVertical,
  Paintbrush,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import {
  listThemes,
  getMyThemeState,
  selectStoreTheme,
  saveStoreThemeCustomization,
  resetStoreTheme,
} from "@/lib/themes.functions";
import {
  ANIMATION_LEVELS,
  ANIMATIONS,
  BADGE_STYLES,
  BUTTON_STYLES,
  CARD_KEYS,
  CARD_LABELS,
  CARD_STYLES,
  COLOR_KEYS,
  COLOR_LABELS,
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
  isLocked,
  mergeTheme,
  type SectionKey,
  type ThemeLocks,
} from "@/lib/theme/definition";
import { ThemePreviewFrame } from "./ThemePreviewFrame";
import { ColorField, SelectField, SliderField, SwitchRow } from "./controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Overrides = Record<string, any>;

const GROUPS = [
  "themes",
  "presets",
  "colors",
  "typography",
  "header",
  "navigation",
  "hero",
  "sections",
  "product_card",
  "buttons",
  "spacing",
  "footer",
] as const;
type Group = (typeof GROUPS)[number];

const GROUP_LABELS: Record<Group, string> = {
  themes: "Themes",
  presets: "Style Presets",
  colors: "Colors",
  typography: "Typography",
  header: "Header",
  navigation: "Navigation",
  hero: "Hero Banner",
  sections: "Homepage Sections",
  product_card: "Product Card",
  buttons: "Buttons & Radius",
  spacing: "Spacing & Layout",
  footer: "Footer",
};

function setIn(obj: Overrides, group: string, key: string, value: unknown): Overrides {
  return { ...obj, [group]: { ...(obj?.[group] ?? {}), [key]: value } };
}

function mergeDeep(base: Overrides, patch: Overrides): Overrides {
  const out: Overrides = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(base[k] ?? {}), ...v } : v;
  }
  return out;
}

export function ThemeCustomizer() {
  const qc = useQueryClient();
  const themesFn = useServerFn(listThemes);
  const stateFn = useServerFn(getMyThemeState);
  const selectFn = useServerFn(selectStoreTheme);
  const saveFn = useServerFn(saveStoreThemeCustomization);
  const resetFn = useServerFn(resetStoreTheme);

  const { data: themes = [] } = useQuery({ queryKey: ["store-themes"], queryFn: () => themesFn() });
  const { data: state } = useQuery({ queryKey: ["my-theme"], queryFn: () => stateFn() });

  const [local, setLocal] = useState<Overrides | null>(null);
  const [open, setOpen] = useState<Group>("themes");
  const past = useRef<Overrides[]>([]);
  const future = useRef<Overrides[]>([]);
  const [, force] = useState(0);

  const active = themes.find((t: any) => t.id === state?.theme_id) as any;
  const saved = useMemo(
    () => ({ ...(state?.overrides ?? {}), ...(state?.draft ?? {}) }) as Overrides,
    [state],
  );
  const overrides = local ?? saved;
  const locks = (active?.locked ?? {}) as ThemeLocks;
  const resolved = mergeTheme(active?.definition, overrides);
  const dirty = local !== null;

  const commit = useCallback(
    (next: Overrides) => {
      past.current = [...past.current.slice(-49), overrides];
      future.current = [];
      setLocal(next);
    },
    [overrides],
  );

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current = [overrides, ...future.current];
    setLocal(prev);
    force((n) => n + 1);
  };
  const redo = () => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, overrides];
    setLocal(next);
    force((n) => n + 1);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-theme"] });
    past.current = [];
    future.current = [];
    setLocal(null);
  };

  const pick = useMutation({
    mutationFn: (themeId: string) => selectFn({ data: { themeId } }),
    onSuccess: () => { toast.success("Theme applied"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: (publish: boolean) => saveFn({ data: { overrides, publish } }),
    onSuccess: (_d, publish) => {
      toast.success(publish ? "Published to your storefront" : "Draft saved");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (full: boolean) => resetFn({ data: { full } }),
    onSuccess: () => { toast.success("Reset done"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const upd = (group: string, key: string, value: unknown) => commit(setIn(overrides, group, key, value));
  const lockedIn = (group: keyof ThemeLocks, key?: string) => isLocked(locks, group, key);

  const moveSection = (from: number, to: number) => {
    if (lockedIn("section_order")) return;
    const order = [...resolved.section_order];
    if (to < 0 || to >= order.length) return;
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    commit({ ...overrides, section_order: order });
  };

  const Accordion = ({ id, children }: { id: Group; children: React.ReactNode }) => (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen(open === id ? ("themes" as Group) : id)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50"
      >
        <span className="min-w-0 truncate">{GROUP_LABELS[id]}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open === id ? "rotate-180" : ""}`} />
      </button>
      {open === id && <div className="space-y-3 border-t p-3">{children}</div>}
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Theme Customization</h1>
          <p className="text-sm text-muted-foreground">
            Pick a platform theme, then fine-tune your storefront with a real live preview.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={undo} disabled={!past.current.length} aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={redo} disabled={!future.current.length} aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Paintbrush className="ml-1 hidden h-5 w-5 text-muted-foreground sm:block" />
        </div>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* ---------- settings rail ---------- */}
        <div className="min-w-0 space-y-2.5">
          <Accordion id="themes">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {themes.map((t: any) => {
                const d = mergeTheme(t.definition, {});
                const selected = t.id === state?.theme_id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick.mutate(t.id)}
                    className={`min-w-0 rounded-lg border p-2 text-left transition hover:shadow-sm ${selected ? "border-primary ring-2 ring-primary/30" : ""}`}
                  >
                    <div className="flex h-12 overflow-hidden rounded-md border">
                      <span className="w-1/4" style={{ background: d.colors.header }} />
                      <span className="w-1/4" style={{ background: d.colors.primary }} />
                      <span className="w-1/4" style={{ background: d.colors.accent }} />
                      <span className="w-1/4" style={{ background: d.colors.footer }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1.5">
                      <span className="min-w-0 truncate text-xs font-medium">{t.name}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </div>
                    <p className="truncate text-[11px] capitalize text-muted-foreground">{t.category}</p>
                  </button>
                );
              })}
              {themes.length === 0 && <p className="text-sm text-muted-foreground">No themes published yet.</p>}
            </div>
          </Accordion>

          {active && (
            <>
              <Accordion id="presets">
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(STYLE_PRESETS).map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant="outline"
                      onClick={() => commit(mergeDeep(overrides, STYLE_PRESETS[p]))}
                    >
                      {PRESET_LABELS[p]}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Presets set radius, shadow, animation and card styling in one click. Locked options stay untouched.
                </p>
              </Accordion>

              <Accordion id="colors">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {COLOR_KEYS.map((k) => (
                    <ColorField
                      key={k}
                      label={COLOR_LABELS[k]}
                      value={resolved.colors[k]}
                      locked={lockedIn("colors", k)}
                      onChange={(v) => upd("colors", k, v)}
                    />
                  ))}
                </div>
              </Accordion>

              <Accordion id="typography">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {(["heading_font", "body_font", "button_font"] as const).map((k) => (
                    <SelectField
                      key={k}
                      label={k.replace(/_/g, " ")}
                      value={(resolved.typography as any)[k]}
                      options={FONT_OPTIONS}
                      locked={lockedIn("typography", k)}
                      onChange={(v) => upd("typography", k, v)}
                    />
                  ))}
                  <SelectField
                    label="Heading weight"
                    value={resolved.typography.heading_weight}
                    options={FONT_WEIGHTS}
                    locked={lockedIn("typography", "heading_weight")}
                    onChange={(v) => upd("typography", "heading_weight", Number(v))}
                  />
                  <SelectField
                    label="Body weight"
                    value={resolved.typography.body_weight}
                    options={FONT_WEIGHTS}
                    locked={lockedIn("typography", "body_weight")}
                    onChange={(v) => upd("typography", "body_weight", Number(v))}
                  />
                  <SliderField
                    label="Base size" suffix="px" min={12} max={20}
                    value={resolved.typography.base_size}
                    locked={lockedIn("typography", "base_size")}
                    onChange={(v) => upd("typography", "base_size", v)}
                  />
                  <SliderField
                    label="Letter spacing" min={-2} max={4} step={0.5}
                    value={resolved.typography.letter_spacing}
                    locked={lockedIn("typography", "letter_spacing")}
                    onChange={(v) => upd("typography", "letter_spacing", v)}
                  />
                  <SliderField
                    label="Line height" min={1} max={2.4} step={0.05}
                    value={resolved.typography.line_height}
                    locked={lockedIn("typography", "line_height")}
                    onChange={(v) => upd("typography", "line_height", v)}
                  />
                </div>
              </Accordion>

              <Accordion id="header">
                <div className="grid gap-2">
                  {HEADER_KEYS.map((k) => (
                    <SwitchRow
                      key={k}
                      label={HEADER_LABELS[k]}
                      checked={!!resolved.header[k]}
                      locked={lockedIn("header", k)}
                      onChange={(v) => upd("header", k, v)}
                    />
                  ))}
                  <SwitchRow
                    label="Sticky header" checked={resolved.header.sticky}
                    locked={lockedIn("header", "sticky")}
                    onChange={(v) => upd("header", "sticky", v)}
                  />
                  <SwitchRow
                    label="Transparent header" checked={resolved.header.transparent}
                    locked={lockedIn("header", "transparent")}
                    onChange={(v) => upd("header", "transparent", v)}
                  />
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SliderField
                    label="Height" suffix="px" min={48} max={120}
                    value={resolved.header.height}
                    locked={lockedIn("header", "height")}
                    onChange={(v) => upd("header", "height", v)}
                  />
                  <SelectField
                    label="Search position" value={resolved.header.search_position} options={HEADER_SEARCH_POS}
                    locked={lockedIn("header", "search_position")}
                    onChange={(v) => upd("header", "search_position", v)}
                  />
                  <SelectField
                    label="Cart position" value={resolved.header.cart_position} options={HEADER_CART_POS}
                    locked={lockedIn("header", "cart_position")}
                    onChange={(v) => upd("header", "cart_position", v)}
                  />
                  <SelectField
                    label="Logo alignment" value={resolved.header.logo_align} options={LOGO_ALIGNS}
                    locked={lockedIn("header", "logo_align")}
                    onChange={(v) => upd("header", "logo_align", v)}
                  />
                </div>
              </Accordion>

              <Accordion id="navigation">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SelectField
                    label="Menu style" value={resolved.nav.menu_style} options={MENU_STYLES}
                    locked={lockedIn("nav", "menu_style")}
                    onChange={(v) => upd("nav", "menu_style", v)}
                  />
                  <SelectField
                    label="Category position" value={resolved.nav.category_position} options={["top", "sidebar"]}
                    locked={lockedIn("nav", "category_position")}
                    onChange={(v) => upd("nav", "category_position", v)}
                  />
                </div>
                <SwitchRow
                  label="Mega menu" checked={resolved.nav.mega_menu}
                  locked={lockedIn("nav", "mega_menu")}
                  onChange={(v) => upd("nav", "mega_menu", v)}
                />
              </Accordion>

              <Accordion id="hero">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SliderField
                    label="Height" suffix="px" min={160} max={640} step={10}
                    value={resolved.hero.height}
                    locked={lockedIn("hero", "height")}
                    onChange={(v) => upd("hero", "height", v)}
                  />
                  <SliderField
                    label="Corner radius" suffix="px" min={0} max={40}
                    value={resolved.hero.radius}
                    locked={lockedIn("hero", "radius")}
                    onChange={(v) => upd("hero", "radius", v)}
                  />
                  <SliderField
                    label="Overlay" suffix="%" min={0} max={80}
                    value={resolved.hero.overlay}
                    locked={lockedIn("hero", "overlay")}
                    onChange={(v) => upd("hero", "overlay", v)}
                  />
                  <SelectField
                    label="Text align" value={resolved.hero.text_align} options={TEXT_ALIGNS}
                    locked={lockedIn("hero", "text_align")}
                    onChange={(v) => upd("hero", "text_align", v)}
                  />
                  <SelectField
                    label="CTA style" value={resolved.hero.cta_style} options={BUTTON_STYLES}
                    locked={lockedIn("hero", "cta_style")}
                    onChange={(v) => upd("hero", "cta_style", v)}
                  />
                  <SelectField
                    label="Animation" value={resolved.animation} options={ANIMATIONS}
                    locked={lockedIn("animation")}
                    onChange={(v) => commit({ ...overrides, animation: v })}
                  />
                </div>
              </Accordion>

              <Accordion id="sections">
                <p className="text-[11px] text-muted-foreground">
                  Toggle sections on or off, and drag to reorder the homepage.
                </p>
                <div className="space-y-1.5">
                  {resolved.section_order.map((k: SectionKey, i: number) => (
                    <div
                      key={k}
                      draggable={!lockedIn("section_order")}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        moveSection(Number(e.dataTransfer.getData("text/plain")), i);
                      }}
                      className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{SECTION_LABELS[k]}</span>
                      <SwitchRow
                        label=""
                        checked={!!resolved.sections[k]}
                        locked={lockedIn("sections", k)}
                        onChange={(v) => upd("sections", k, v)}
                      />
                    </div>
                  ))}
                </div>
              </Accordion>

              <Accordion id="product_card">
                <div className="grid gap-2">
                  {CARD_KEYS.map((k) => (
                    <SwitchRow
                      key={k}
                      label={CARD_LABELS[k]}
                      checked={!!resolved.product_card[k]}
                      locked={lockedIn("product_card", k)}
                      onChange={(v) => upd("product_card", k, v)}
                    />
                  ))}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SelectField label="Card style" value={resolved.product_card.style} options={CARD_STYLES}
                    locked={lockedIn("product_card", "style")} onChange={(v) => upd("product_card", "style", v)} />
                  <SelectField label="Shadow" value={resolved.product_card.shadow} options={SHADOW_LEVELS}
                    locked={lockedIn("product_card", "shadow")} onChange={(v) => upd("product_card", "shadow", v)} />
                  <SliderField label="Radius" suffix="px" min={0} max={30} value={resolved.product_card.radius}
                    locked={lockedIn("product_card", "radius")} onChange={(v) => upd("product_card", "radius", v)} />
                  <SelectField label="Image ratio" value={resolved.product_card.image_ratio} options={IMAGE_RATIOS}
                    locked={lockedIn("product_card", "image_ratio")} onChange={(v) => upd("product_card", "image_ratio", v)} />
                  <SelectField label="Hover effect" value={resolved.product_card.hover} options={HOVER_EFFECTS}
                    locked={lockedIn("product_card", "hover")} onChange={(v) => upd("product_card", "hover", v)} />
                  <SelectField label="Badge style" value={resolved.product_card.badge_style} options={BADGE_STYLES}
                    locked={lockedIn("product_card", "badge_style")} onChange={(v) => upd("product_card", "badge_style", v)} />
                  <SelectField label="Button style" value={resolved.product_card.button_style} options={BUTTON_STYLES}
                    locked={lockedIn("product_card", "button_style")} onChange={(v) => upd("product_card", "button_style", v)} />
                  <SelectField label="Rating style" value={resolved.product_card.rating_style} options={RATING_STYLES}
                    locked={lockedIn("product_card", "rating_style")} onChange={(v) => upd("product_card", "rating_style", v)} />
                  <SelectField label="Price style" value={resolved.product_card.price_style} options={PRICE_STYLES}
                    locked={lockedIn("product_card", "price_style")} onChange={(v) => upd("product_card", "price_style", v)} />
                </div>
              </Accordion>

              <Accordion id="buttons">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SliderField label="Button radius" suffix="px" min={0} max={32} value={resolved.buttons.radius}
                    locked={lockedIn("buttons", "radius")} onChange={(v) => upd("buttons", "radius", v)} />
                  <SelectField label="Button style" value={resolved.buttons.style} options={BUTTON_STYLES}
                    locked={lockedIn("buttons", "style")} onChange={(v) => upd("buttons", "style", v)} />
                  <SliderField label="Border width" suffix="px" min={0} max={4} value={resolved.buttons.border}
                    locked={lockedIn("buttons", "border")} onChange={(v) => upd("buttons", "border", v)} />
                  <SelectField label="Button shadow" value={resolved.buttons.shadow} options={SHADOW_LEVELS}
                    locked={lockedIn("buttons", "shadow")} onChange={(v) => upd("buttons", "shadow", v)} />
                  <SelectField label="Hover animation" value={resolved.buttons.hover_animation} options={HOVER_EFFECTS}
                    locked={lockedIn("buttons", "hover_animation")} onChange={(v) => upd("buttons", "hover_animation", v)} />
                  <ColorField label="Hover color" value={resolved.buttons.hover_color}
                    locked={lockedIn("buttons", "hover_color")} onChange={(v) => upd("buttons", "hover_color", v)} />
                  <SliderField label="Global radius" suffix="px" min={0} max={30} value={resolved.global.radius}
                    locked={lockedIn("global", "radius")} onChange={(v) => upd("global", "radius", v)} />
                  <SelectField label="Global shadow" value={resolved.global.shadow} options={SHADOW_LEVELS}
                    locked={lockedIn("global", "shadow")} onChange={(v) => upd("global", "shadow", v)} />
                  <SelectField label="Animation level" value={resolved.global.animation_level} options={ANIMATION_LEVELS}
                    locked={lockedIn("global", "animation_level")} onChange={(v) => upd("global", "animation_level", v)} />
                </div>
              </Accordion>

              <Accordion id="spacing">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SliderField label="Container width" suffix="px" min={960} max={1600} step={20}
                    value={resolved.spacing.container} locked={lockedIn("spacing", "container")}
                    onChange={(v) => upd("spacing", "container", v)} />
                  <SliderField label="Section gap" suffix="px" min={8} max={120} step={4}
                    value={resolved.spacing.section_gap} locked={lockedIn("spacing", "section_gap")}
                    onChange={(v) => upd("spacing", "section_gap", v)} />
                  <SliderField label="Card gap" suffix="px" min={4} max={48}
                    value={resolved.spacing.card_gap} locked={lockedIn("spacing", "card_gap")}
                    onChange={(v) => upd("spacing", "card_gap", v)} />
                  <SliderField label="Padding" suffix="px" min={0} max={48}
                    value={resolved.spacing.padding} locked={lockedIn("spacing", "padding")}
                    onChange={(v) => upd("spacing", "padding", v)} />
                </div>
              </Accordion>

              <Accordion id="footer">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <SelectField label="Layout" value={resolved.footer.layout} options={FOOTER_LAYOUTS}
                    locked={lockedIn("footer")} onChange={(v) => upd("footer", "layout", v)} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone</label>
                    <Input className="h-9" disabled={lockedIn("footer")} value={resolved.footer.phone ?? ""}
                      onChange={(e) => upd("footer", "phone", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input className="h-9" disabled={lockedIn("footer")} value={resolved.footer.email ?? ""}
                      onChange={(e) => upd("footer", "email", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Address</label>
                    <Input className="h-9" disabled={lockedIn("footer")} value={resolved.footer.address ?? ""}
                      onChange={(e) => upd("footer", "address", e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <SwitchRow label="Social icons" checked={!!resolved.footer.social} locked={lockedIn("footer")}
                    onChange={(v) => upd("footer", "social", v)} />
                  <SwitchRow label="Copyright line" checked={!!resolved.footer.copyright} locked={lockedIn("footer")}
                    onChange={(v) => upd("footer", "copyright", v)} />
                  <SwitchRow label="Payment icons" checked={!!resolved.footer.payment_icons} locked={lockedIn("footer")}
                    onChange={(v) => upd("footer", "payment_icons", v)} />
                </div>
              </Accordion>
            </>
          )}
        </div>

        {/* ---------- live preview ---------- */}
        <div className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
          {state?.slug ? (
            <ThemePreviewFrame slug={state.slug} />
          ) : (
            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
              Create your store to see the live preview.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
              {active ? `Theme: ${active.name}` : "No theme selected"}
              {dirty ? " · unsaved changes" : ""}
            </span>
            <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending || !active}>
              <Save className="mr-1.5 h-4 w-4" /> Publish changes
            </Button>
            <Button size="sm" variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending || !dirty}>
              Save draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => reset.mutate(false)} disabled={reset.isPending}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={() => reset.mutate(true)} disabled={reset.isPending}>
              Restore default theme
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
