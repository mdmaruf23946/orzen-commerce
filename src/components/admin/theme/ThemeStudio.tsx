// Theme Studio (beta): left = every storefront part from header to footer,
// each with several designs shown as small previews; right = the real store
// in a live preview that updates instantly. Publish pushes it to the store.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, GripVertical, Loader2, Monitor, RotateCcw, Save, Smartphone, Tablet, Undo2 } from "lucide-react";
import { getMyThemeState, listThemes, saveStoreThemeCustomization, selectStoreTheme } from "@/lib/site-builder/themes.functions";
import { COLOR_KEYS, COLOR_LABELS, SECTION_LABELS, mergeTheme, type SectionKey, type ThemeDefinition } from "@/lib/theme/definition";
import { THEME_PREVIEW_MESSAGE, THEME_PREVIEW_PARAM, THEME_PREVIEW_READY } from "@/lib/theme/context";
import { STUDIO_PARTS, activeVariantId, applyVariant, reorder, type StudioPart } from "@/lib/theme/studio-variants";
import { Button } from "@/components/ui/button";
import { ColorField } from "./controls";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Overrides = Record<string, any>;
const DEVICES = {
  desktop: { w: 1280, h: 760, icon: Monitor },
  tablet: { w: 820, h: 1080, icon: Tablet },
  mobile: { w: 390, h: 780, icon: Smartphone },
} as const;
type Mode = keyof typeof DEVICES;

/** Small schematic drawing of one part rendered with a candidate theme. */
function MiniPreview({ part, t }: { part: string; t: ThemeDefinition }) {
  const c = t.colors;
  const r = (n: number) => Math.min(n, 14) / 2;
  const bar = (w: string, bg = c.muted, h = 4) => <div style={{ width: w, height: h, background: bg, borderRadius: 2, opacity: 0.6 }} />;
  const box = { background: c.background, fontFamily: t.typography.heading_font } as React.CSSProperties;
  if (part === "navigation") {
    const n = t.nav;
    const mode = n.category_mode ?? "more";
    const pill = (i: number, active: boolean) => (
      <div key={i} style={{
        width: 14, height: 6, flexShrink: 0,
        background: n.menu_style === "pill" ? (active ? c.primary : c.card) : active ? c.card : c.muted,
        border: n.menu_style === "pill" ? `1px solid ${c.border}` : undefined,
        borderRadius: n.menu_style === "pill" ? 6 : 1,
        borderBottom: n.menu_style === "underline" ? `2px solid ${active ? c.primary : "transparent"}` : undefined,
        opacity: active ? 1 : 0.6,
      }} />
    );
    return (
      <div style={{ ...box, height: 60 }} className="flex flex-col justify-center px-2">
        <div style={{ background: n.menu_style === "inline" ? `${c.primary}22` : "transparent", borderRadius: 4, padding: 3 }}
          className={cn("flex items-center gap-1", mode === "wrap" ? "flex-wrap" : "overflow-hidden")}>
          {Array.from({ length: mode === "wrap" ? 11 : 6 }).map((_, i) => pill(i, i === 0))}
          {mode === "more" && <div style={{ marginLeft: "auto", fontSize: 7, color: c.primary, fontWeight: 700 }}>More ▾</div>}
          {mode === "scroll" && <div style={{ marginLeft: "auto", fontSize: 8, color: c.primary }}>›</div>}
        </div>
      </div>
    );
  }
  if (part === "header") {
    const h = t.header;
    const center = h.logo_align === "center";
    return (
      <div style={{ ...box, height: 60 }} className="flex flex-col">
        <div style={{ background: h.transparent ? `repeating-linear-gradient(45deg, ${c.surface}, ${c.surface} 4px, ${c.background} 4px, ${c.background} 8px)` : c.header, height: Math.max(18, h.height / 2.6), borderBottom: `1px solid ${c.border}` }}
          className="relative flex items-center gap-1.5 px-2">
          {h.cart_position === "left" && <div style={{ width: 9, height: 9, borderRadius: 2, background: c.primary }} />}
          <div className={cn("flex items-center gap-1", center && "absolute left-1/2 -translate-x-1/2")}>
            <div style={{ width: 8, height: 8, borderRadius: 8, background: c.primary }} />
            {h.logo_mode !== "icon" && <div style={{ width: h.logo_size === "large" ? 34 : 22, height: 7, background: c.ink, borderRadius: 2 }} />}
          </div>
          {h.search_position !== "hidden" && <div style={{ width: h.search_position === "center" ? 52 : 34, height: 8, borderRadius: 4, border: `1px solid ${c.border}`, background: c.surface }} className={h.search_position === "center" ? "mx-auto" : "ml-auto"} />}
          {h.search_position === "hidden" && <div className="ml-auto" />}
          {h.cart_position !== "left" && <div style={{ width: 9, height: 9, borderRadius: 2, background: c.primary }} />}
          <div style={{ width: 9, height: 9, borderRadius: 9, border: `1.5px solid ${c.ink}` }} />
        </div>
        <div style={{ fontSize: 7, color: c.muted }} className="px-2 pt-1">{h.sticky ? "Sticky" : "Scrolls"} · {h.height}px</div>
      </div>
    );
  }
  if (part === "hero") {
    const L = t.banner.layout ?? "split_right";
    const big = { background: `linear-gradient(135deg, ${c.primary}, ${c.accent})`, borderRadius: 3 } as React.CSSProperties;
    const sm = { background: `${c.accent}aa`, borderRadius: 3 } as React.CSSProperties;
    const wrap = "h-full w-full gap-1 p-1.5";
    return (
      <div style={{ ...box, height: 60 }}>
        {L === "split_right" && <div className={cn(wrap, "grid grid-cols-[3fr_1fr] grid-rows-2")}><div style={big} className="row-span-2" /><div style={sm} /><div style={sm} /></div>}
        {L === "split_left" && <div className={cn(wrap, "grid grid-cols-[1fr_3fr] grid-rows-2")}><div style={sm} /><div style={big} className="row-span-2" /><div style={sm} /></div>}
        {L === "stacked" && <div className={cn(wrap, "grid grid-cols-2 grid-rows-[2fr_1fr]")}><div style={big} className="col-span-2" /><div style={sm} /><div style={sm} /></div>}
        {L === "full" && <div className="flex h-full flex-col gap-1 pb-1.5"><div style={{ ...big, borderRadius: 0 }} className="flex-[2]" /><div className="grid flex-1 grid-cols-2 gap-1 px-1.5"><div style={sm} /><div style={sm} /></div></div>}
        {L === "trio" && <div className={cn(wrap, "grid grid-cols-3 items-center")}><div style={{ ...big, height: 30 }} /><div style={{ ...sm, height: 30 }} /><div style={{ ...sm, height: 30 }} /></div>}
        {L === "strip" && <div className="flex h-full items-center p-1.5"><div style={{ ...big, height: 16 }} className="w-full" /></div>}
      </div>
    );
  }
  if (part === "product_card") {
    const p = t.product_card;
    const ratio = p.image_ratio === "portrait" ? 30 : p.image_ratio === "landscape" ? 16 : 22;
    return (
      <div style={{ ...box, height: 60 }} className="flex items-start justify-center gap-1.5 p-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 26, borderRadius: r(p.radius),
            background: p.style === "glass" ? `${c.surface}aa` : c.card,
            border: p.style === "bordered" ? `1px solid ${c.border}` : undefined,
            boxShadow: p.style === "elevated" || p.style === "glass" ? "0 2px 6px rgba(0,0,0,.15)" : undefined,
            overflow: "hidden",
          }}>
            <div style={{ height: ratio, background: c.muted, opacity: 0.35 }} />
            <div className="space-y-0.5 p-0.5">{bar("90%")}{bar("50%", c.primary, p.price_style === "bold" ? 5 : 3)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (part === "buttons") {
    const b = t.buttons;
    const style = (solid: boolean): React.CSSProperties => ({
      width: 42, height: 14, borderRadius: Math.min(b.radius, 7),
      background: b.style === "solid" && solid ? c.button : b.style === "soft" ? `${c.button}33` : "transparent",
      border: b.style === "outline" || !solid ? `1.5px solid ${c.button}` : undefined,
    });
    return <div style={{ ...box, height: 60 }} className="flex items-center justify-center gap-2"><div style={style(true)} /><div style={style(false)} /></div>;
  }
  if (part === "colors") {
    return (
      <div style={{ height: 60 }} className="grid grid-cols-5">
        {[c.primary, c.accent, c.header, c.background, c.footer].map((x, i) => <div key={i} style={{ background: x }} />)}
      </div>
    );
  }
  if (part === "typography") {
    return (
      <div style={{ ...box, height: 60, color: c.ink }} className="flex flex-col justify-center px-2">
        <div style={{ fontFamily: t.typography.heading_font, fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>Aa Heading</div>
        <div style={{ fontFamily: t.typography.body_font, fontSize: 10, color: c.text }}>Body text sample</div>
      </div>
    );
  }
  if (part === "spacing") {
    const s = t.spacing;
    return (
      <div style={{ ...box, height: 60 }} className="flex justify-center">
        <div style={{ width: `${(s.container / 1400) * 100}%`, gap: s.card_gap / 6, paddingTop: s.section_gap / 8 }} className="grid grid-cols-4 px-1">
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 22, background: c.muted, opacity: 0.35, borderRadius: 2 }} />)}
        </div>
      </div>
    );
  }
  // footer
  const f = t.footer;
  return (
    <div style={{ height: 60, background: c.footer }} className={cn("flex flex-col justify-end gap-1 p-1.5", f.layout === "centered" && "items-center")}>
      {f.layout === "columns" ? (
        <div className="grid w-full grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="space-y-0.5">{bar("80%", "#fff")}{bar("60%", "#fff")}</div>)}</div>
      ) : (
        <div className="flex gap-1">{bar("30px", "#fff")}{bar("20px", "#fff")}</div>
      )}
      {f.social && <div className="flex gap-0.5">{[0, 1, 2].map((i) => <div key={i} style={{ width: 5, height: 5, borderRadius: 5, background: "#fff", opacity: 0.7 }} />)}</div>}
    </div>
  );
}

export function ThemeStudio() {
  const qc = useQueryClient();
  const themesFn = useServerFn(listThemes);
  const stateFn = useServerFn(getMyThemeState);
  const saveFn = useServerFn(saveStoreThemeCustomization);
  const selectFn = useServerFn(selectStoreTheme);
  const { data: themes = [] } = useQuery({ queryKey: ["store-themes"], queryFn: () => themesFn() });
  const { data: state, isLoading } = useQuery({ queryKey: ["my-theme"], queryFn: () => stateFn() });

  const active = (themes as any[]).find((t) => t.id === state?.theme_id);
  const saved = useMemo(() => ({ ...(state?.overrides ?? {}), ...(state?.draft ?? {}) }) as Overrides, [state]);
  const [local, setLocal] = useState<Overrides | null>(null);
  const [history, setHistory] = useState<Overrides[]>([]);
  const overrides = local ?? saved;
  const resolved = mergeTheme(active?.definition, overrides);
  const [openPart, setOpenPart] = useState<string>("header");
  const [mode, setMode] = useState<Mode>("desktop");
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const device = DEVICES[mode];

  const commit = (next: Overrides) => {
    setHistory((h) => [...h.slice(-49), overrides]);
    setLocal(next);
  };

  // Stream the edited theme to the live preview.
  const push = () =>
    frameRef.current?.contentWindow?.postMessage(
      { type: THEME_PREVIEW_MESSAGE, definition: active?.definition ?? null, overrides },
      window.location.origin,
    );
  useEffect(() => { push(); });
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === THEME_PREVIEW_READY) push();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth <= 0) return;
      const byW = (el.clientWidth - 14) / device.w;
      const byH = el.clientHeight > 40 && window.innerWidth >= 1024 ? (el.clientHeight - 14) / device.h : byW;
      setScale(Math.min(1, Math.max(0.1, Math.min(byW, byH))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device.w, device.h]);

  const save = useMutation({
    mutationFn: (publish: boolean) => saveFn({ data: { overrides, publish } }),
    onSuccess: (_d, publish) => {
      toast.success(publish ? "স্টোরে পাবলিশ হয়েছে" : "ড্রাফট সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["my-theme"] });
      setLocal(null);
      setHistory([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pickTheme = useMutation({
    mutationFn: (themeId: string) => selectFn({ data: { themeId } }),
    onSuccess: () => {
      toast.success("থিম বদলানো হয়েছে");
      setLocal(null);
      setHistory([]);
      qc.invalidateQueries({ queryKey: ["my-theme"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const order = resolved.section_order;

  const themeGrid = (
    <div className="grid grid-cols-2 gap-2 border-t p-2">
      {(themes as any[]).map((t) => {
        const d = mergeTheme(t.definition, {});
        const sel = t.id === state?.theme_id;
        return (
          <button key={t.id} type="button" disabled={pickTheme.isPending}
            onClick={() => { if (!sel && (local === null || confirm("থিম বদলালে অপ্রকাশিত পরিবর্তন মুছে যাবে। চালিয়ে যাবেন?"))) pickTheme.mutate(t.id); }}
            className={cn("overflow-hidden rounded-lg border text-left transition hover:border-primary", sel && "border-primary ring-2 ring-primary/40")}>
            <div className="flex h-10">
              {[d.colors.header, d.colors.primary, d.colors.accent, d.colors.footer].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
            </div>
            <div className="truncate border-t bg-card px-2 py-1 text-xs font-medium">{t.name}</div>
          </button>
        );
      })}
    </div>
  );

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!state?.slug) return null;
  if (!active)
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">শুরু করতে একটি থিম বেছে নিন</p>
        {themeGrid}
      </div>
    );

  const partBlock = (part: StudioPart) => {
    const current = activeVariantId(part, resolved as any);
    return (
      <div key={part.id} className="overflow-hidden rounded-xl border bg-card">
        <button type="button" onClick={() => setOpenPart(openPart === part.id ? "" : part.id)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50">
          <span>{part.label} <span className="ml-1 text-xs text-muted-foreground">({part.variants.length} ডিজাইন)</span></span>
          <ChevronRight className={cn("h-4 w-4 transition-transform", openPart === part.id && "rotate-90")} />
        </button>
        {openPart === part.id && (
          <div className="grid grid-cols-2 gap-2 border-t p-2">
            {part.variants.map((vr) => {
              const t = mergeTheme(active.definition, applyVariant(overrides, vr.patch));
              return (
                <button key={vr.id} type="button" onClick={() => commit(applyVariant(overrides, vr.patch))}
                  className={cn("overflow-hidden rounded-lg border text-left transition hover:border-primary",
                    current === vr.id && "border-primary ring-2 ring-primary/40")}>
                  <MiniPreview part={part.id} t={t} />
                  <div className="truncate border-t bg-card px-2 py-1 text-xs font-medium">{vr.name}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const [headerParts, footerParts] = [STUDIO_PARTS.slice(0, 3), STUDIO_PARTS.slice(3)];

  return (
    <div className="flex flex-col gap-2 lg:-mx-4 lg:-my-6 lg:h-[calc(100dvh-5.5rem)] lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap [&_button]:whitespace-nowrap">
        <h1 className="mr-auto whitespace-nowrap text-base font-semibold">Theme Studio <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Beta</span></h1>
        <Button size="sm" variant="ghost" disabled={!history.length} onClick={() => { const h = [...history]; const prev = h.pop()!; setHistory(h); setLocal(prev); }}>
          <Undo2 className="mr-1 h-4 w-4" /> Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={local === null} onClick={() => { setLocal(null); setHistory([]); }}>
          <RotateCcw className="mr-1 h-4 w-4" /> বাতিল
        </Button>
        <Button size="sm" variant="outline" disabled={save.isPending || local === null} onClick={() => save.mutate(false)}>ড্রাফট সেভ</Button>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(true)}>
          <Save className="mr-1 h-4 w-4" /> Publish
        </Button>
        <div className="ml-2 flex items-center gap-1 border-l pl-3">
          {(Object.keys(DEVICES) as Mode[]).map((m) => {
              const Icon = DEVICES[m].icon;
              return (
                <Button key={m} size="sm" className="h-8 px-2.5" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              );
            })}
        </div>
      </div>

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-2 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <button type="button" onClick={() => setOpenPart(openPart === "themes" ? "" : "themes")}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50">
              <span>Ready Themes <span className="ml-1 text-xs text-muted-foreground">({themes.length} থিম)</span></span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", openPart === "themes" && "rotate-90")} />
            </button>
            {openPart === "themes" && themeGrid}
          </div>

          {headerParts.map(partBlock)}

          <div className="overflow-hidden rounded-xl border bg-card">
            <button type="button" onClick={() => setOpenPart(openPart === "sections" ? "" : "sections")}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50">
              <span>Homepage Sections <span className="ml-1 text-xs text-muted-foreground">(টেনে সাজান)</span></span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", openPart === "sections" && "rotate-90")} />
            </button>
            {openPart === "sections" && (
              <div className="space-y-1 border-t p-2">
                {order.map((key: SectionKey, i: number) => (
                  <div key={key} draggable
                    onDragStart={() => setDrag(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (drag !== null) commit({ ...overrides, section_order: reorder(order, drag, i) }); setDrag(null); }}
                    className={cn("flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm", drag === i && "opacity-50")}>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="mr-auto">{SECTION_LABELS[key]}</span>
                    <Switch checked={!!resolved.sections[key]}
                      onCheckedChange={(on) => commit({ ...overrides, sections: { ...(overrides.sections ?? {}), [key]: on } })} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {footerParts.map(partBlock)}

          <div className="overflow-hidden rounded-xl border bg-card">
            <button type="button" onClick={() => setOpenPart(openPart === "custom_colors" ? "" : "custom_colors")}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50">
              <span>নিজের রং বাছুন <span className="ml-1 text-xs text-muted-foreground">({COLOR_KEYS.length}টি)</span></span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", openPart === "custom_colors" && "rotate-90")} />
            </button>
            {openPart === "custom_colors" && (
              <div className="grid gap-2 border-t p-2">
                {COLOR_KEYS.map((k) => (
                  <ColorField key={k} label={COLOR_LABELS[k]} value={(resolved.colors as any)[k]}
                    onChange={(val) => commit({ ...overrides, colors: { ...(overrides.colors ?? {}), [k]: val } })} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1 lg:h-full lg:min-h-0">
          <div ref={wrapRef} className="flex w-full min-w-0 max-w-full items-start justify-center overflow-hidden overscroll-contain rounded-xl border bg-muted/30 p-1.5 lg:min-h-0 lg:flex-1">
            <div className="shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm" style={{ width: device.w * scale, height: device.h * scale }}>
              <iframe ref={frameRef} key={mode} title="Store live preview" onLoad={push}
                src={`/store/${state.slug}?${THEME_PREVIEW_PARAM}=1`}
                className="border-0"
                style={{ width: device.w, height: device.h, transform: `scale(${scale})`, transformOrigin: "top left" }} />
            </div>
          </div>
          {local !== null && <p className="shrink-0 text-xs text-muted-foreground">পরিবর্তনগুলো এখনো পাবলিশ হয়নি — Publish চাপলে স্টোরে দেখা যাবে।</p>}
        </div>
      </div>
    </div>
  );
}
