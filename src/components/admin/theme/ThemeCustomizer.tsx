import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Lock, Paintbrush, RotateCcw, Save } from "lucide-react";
import {
  listThemes,
  getMyThemeState,
  selectStoreTheme,
  saveStoreThemeCustomization,
  resetStoreTheme,
} from "@/lib/themes.functions";
import {
  ANIMATIONS,
  BUTTON_STYLES,
  CARD_KEYS,
  CARD_LABELS,
  COLOR_KEYS,
  COLOR_LABELS,
  FONT_OPTIONS,
  HEADER_KEYS,
  HEADER_LABELS,
  SECTION_KEYS,
  SECTION_LABELS,
  isLocked,
  mergeTheme,
  themeCssVars,
  type ThemeLocks,
} from "@/lib/theme/definition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function set(obj: any, group: string, key: string, value: unknown) {
  return { ...obj, [group]: { ...(obj?.[group] ?? {}), [key]: value } };
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

  const [local, setLocal] = useState<any | null>(null);
  const [tab, setTab] = useState<"colors" | "typography" | "layout" | "cards" | "buttons">("colors");

  const active = themes.find((t: any) => t.id === state?.theme_id) as any;
  const saved = useMemo(
    () => ({ ...(state?.overrides ?? {}), ...(state?.draft ?? {}) }),
    [state],
  );
  const overrides = local ?? saved;
  const locks = (active?.locked ?? {}) as ThemeLocks;
  const resolved = mergeTheme(active?.definition, overrides);
  const dirty = local !== null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-theme"] });
    setLocal(null);
  };

  const pick = useMutation({
    mutationFn: (themeId: string) => selectFn({ data: { themeId } }),
    onSuccess: () => { toast.success("Theme applied"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: (publish: boolean) => saveFn({ data: { overrides, publish } }),
    onSuccess: (_d, publish) => { toast.success(publish ? "Published to your storefront" : "Draft saved"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (full: boolean) => resetFn({ data: { full } }),
    onSuccess: () => { toast.success("Reset done"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const upd = (group: string, key: string, value: unknown) => setLocal(set(overrides, group, key, value));

  const LockNote = ({ on }: { on: boolean }) =>
    on ? <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked by platform" /> : null;

  return (
    <div className="min-w-0 space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Theme Customization</h1>
          <p className="text-sm text-muted-foreground">
            Pick a platform theme, then fine-tune the parts your plan allows.
          </p>
        </div>
        <Paintbrush className="h-5 w-5 shrink-0 text-muted-foreground" />
      </header>

      {/* Step 1 — theme catalog */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">1. Choose a theme</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((t: any) => {
            const d = mergeTheme(t.definition, {});
            const selected = t.id === state?.theme_id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pick.mutate(t.id)}
                className={`min-w-0 rounded-xl border p-3 text-left transition hover:shadow-sm ${selected ? "border-primary ring-2 ring-primary/30" : ""}`}
              >
                <div className="flex h-16 overflow-hidden rounded-lg border">
                  <span className="w-1/4" style={{ background: d.colors.header }} />
                  <span className="w-1/4" style={{ background: d.colors.primary }} />
                  <span className="w-1/4" style={{ background: d.colors.accent }} />
                  <span className="w-1/4" style={{ background: d.colors.footer }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <p className="truncate text-xs capitalize text-muted-foreground">{t.category}</p>
              </button>
            );
          })}
          {themes.length === 0 && (
            <p className="text-sm text-muted-foreground">No themes published yet.</p>
          )}
        </div>
      </section>

      {/* Step 2 — customization */}
      {active && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap gap-1.5">
              {(["colors", "typography", "layout", "cards", "buttons"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`rounded-full border px-3 py-1.5 text-xs capitalize ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {k}
                </button>
              ))}
            </div>

            {tab === "colors" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {COLOR_KEYS.map((k) => {
                  const locked = isLocked(locks, "colors", k);
                  return (
                    <div key={k} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        {COLOR_LABELS[k]} <LockNote on={locked} />
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          disabled={locked}
                          value={resolved.colors[k]}
                          onChange={(e) => upd("colors", k, e.target.value)}
                          className="h-9 w-12 shrink-0 rounded-md border disabled:opacity-50"
                        />
                        <Input
                          disabled={locked}
                          value={resolved.colors[k]}
                          onChange={(e) => upd("colors", k, e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "typography" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["heading_font", "body_font", "button_font"] as const).map((k) => {
                  const locked = isLocked(locks, "typography", k);
                  return (
                    <div key={k} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs capitalize">
                        {k.replace("_", " ")} <LockNote on={locked} />
                      </Label>
                      <select
                        disabled={locked}
                        value={(resolved.typography as any)[k]}
                        onChange={(e) => upd("typography", k, e.target.value)}
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                      >
                        {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  );
                })}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs">
                    Base size — {resolved.typography.base_size}px
                    <LockNote on={isLocked(locks, "typography", "base_size")} />
                  </Label>
                  <input
                    type="range" min={12} max={20} step={1}
                    disabled={isLocked(locks, "typography", "base_size")}
                    value={resolved.typography.base_size}
                    onChange={(e) => upd("typography", "base_size", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {tab === "layout" && (
              <div className="space-y-4">
                <ToggleGroup
                  title="Header"
                  keys={HEADER_KEYS as readonly string[]}
                  labels={HEADER_LABELS as Record<string, string>}
                  values={resolved.header as Record<string, boolean>}
                  lockedFor={(k) => isLocked(locks, "header", k)}
                  onChange={(k, v) => upd("header", k, v)}
                />
                <ToggleGroup
                  title="Home sections"
                  keys={SECTION_KEYS as readonly string[]}
                  labels={SECTION_LABELS as Record<string, string>}
                  values={resolved.sections as Record<string, boolean>}
                  lockedFor={(k) => isLocked(locks, "sections", k)}
                  onChange={(k, v) => upd("sections", k, v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Animation</Label>
                  <select
                    disabled={isLocked(locks, "animation")}
                    value={resolved.animation}
                    onChange={(e) => setLocal({ ...overrides, animation: e.target.value })}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm capitalize disabled:opacity-50"
                  >
                    {ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            )}

            {tab === "cards" && (
              <ToggleGroup
                title="Product card"
                keys={CARD_KEYS as readonly string[]}
                labels={CARD_LABELS as Record<string, string>}
                values={resolved.product_card as Record<string, boolean>}
                lockedFor={(k) => isLocked(locks, "product_card", k)}
                onChange={(k, v) => upd("product_card", k, v)}
              />
            )}

            {tab === "buttons" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Radius — {resolved.buttons.radius}px</Label>
                  <input
                    type="range" min={0} max={32} step={1}
                    disabled={isLocked(locks, "buttons")}
                    value={resolved.buttons.radius}
                    onChange={(e) => upd("buttons", "radius", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Style</Label>
                  <select
                    disabled={isLocked(locks, "buttons")}
                    value={resolved.buttons.style}
                    onChange={(e) => upd("buttons", "style", e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm capitalize disabled:opacity-50"
                  >
                    {BUTTON_STYLES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hover color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={isLocked(locks, "buttons")}
                      value={resolved.buttons.hover_color}
                      onChange={(e) => upd("buttons", "hover_color", e.target.value)}
                      className="h-9 w-12 shrink-0 rounded-md border disabled:opacity-50"
                    />
                    <Input
                      disabled={isLocked(locks, "buttons")}
                      value={resolved.buttons.hover_color}
                      onChange={(e) => upd("buttons", "hover_color", e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button size="sm" onClick={() => save.mutate(true)} disabled={save.isPending}>
                <Save className="mr-1.5 h-4 w-4" /> Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending || !dirty}>
                Save draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reset.mutate(false)} disabled={reset.isPending}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset customization
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reset.mutate(true)} disabled={reset.isPending}>
                Restore default theme
              </Button>
            </div>
          </div>

          <ThemePreview vars={themeCssVars(resolved)} theme={resolved} name={active.name} />
        </section>
      )}
    </div>
  );
}

function ToggleGroup({
  title, keys, labels, values, lockedFor, onChange,
}: {
  title: string;
  keys: readonly string[];
  labels: Record<string, string>;
  values: Record<string, boolean>;
  lockedFor: (k: string) => boolean;
  onChange: (k: string, v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <span className="min-w-0 truncate text-sm">{labels[k]}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {lockedFor(k) && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              <Switch
                checked={!!values[k]}
                disabled={lockedFor(k)}
                onCheckedChange={(v) => onChange(k, v)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemePreview({ vars, theme, name }: { vars: Record<string, string>; theme: any; name: string }) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Live preview — {name}</div>
        <div style={vars as React.CSSProperties} className="p-3">
          <div
            className="flex items-center justify-between rounded-t-lg px-3 py-2 text-xs"
            style={{ background: "var(--store-header-bg)", fontFamily: "var(--store-body-font)" }}
          >
            <span className="font-semibold">Your Store</span>
            <span className="flex gap-2 opacity-70">
              {theme.header.search && <span>Search</span>}
              {theme.header.cart && <span>Cart</span>}
              {theme.header.account && <span>Account</span>}
            </span>
          </div>
          {theme.sections.banner && (
            <div className="h-20" style={{ background: "var(--primary)" }} />
          )}
          <div className="grid grid-cols-2 gap-2 bg-background p-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-2" style={{ borderRadius: "var(--radius)" }}>
                <div className="h-14 rounded bg-muted" />
                <p className="mt-1.5 truncate text-xs" style={{ fontFamily: "var(--store-heading-font)" }}>
                  Product {i}
                </p>
                {theme.product_card.rating && <p className="text-[10px] text-muted-foreground">★★★★☆</p>}
                {theme.product_card.add_to_cart && (
                  <div
                    className="mt-1.5 py-1 text-center text-[10px] text-white"
                    style={{ background: "var(--store-btn-bg)", borderRadius: "var(--radius)" }}
                  >
                    Add to cart
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="h-10 rounded-b-lg" style={{ background: "var(--store-footer-bg)" }} />
        </div>
      </div>
    </aside>
  );
}
