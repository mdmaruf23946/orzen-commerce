// Theme Studio (beta): left = every storefront part from header to footer,
// each with several designs shown as small previews; right = the real store
// in a live preview that updates instantly. Publish pushes it to the store.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, GripVertical, Loader2, Monitor, RotateCcw, Save, Smartphone, Tablet, Undo2 } from "lucide-react";
import { getMyThemeState, listThemes, saveStoreThemeCustomization } from "@/lib/site-builder/themes.functions";
import { SECTION_LABELS, mergeTheme, type SectionKey, type ThemeDefinition } from "@/lib/theme/definition";
import { THEME_PREVIEW_MESSAGE, THEME_PREVIEW_PARAM, THEME_PREVIEW_READY } from "@/lib/theme/context";
import { STUDIO_PARTS, activeVariantId, applyVariant, reorder, type StudioPart } from "@/lib/theme/studio-variants";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Overrides = Record<string, any>;
const DEVICES = {
  desktop: { w: 1280, h: 860, icon: Monitor },
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
  if (part === "header" || part === "navigation") {
    const h = t.header;
    const center = h.logo_align === "center";
    return (
      <div style={{ ...box, height: 60 }} className="flex flex-col">
        <div style={{ background: h.transparent ? "transparent" : c.header, height: Math.max(18, h.height / 3), borderBottom: `1px solid ${c.border}` }}
          className={cn("flex items-center gap-1 px-2", center ? "justify-center" : "justify-between")}>
          {h.cart_position === "left" && <div style={{ width: 8, height: 8, borderRadius: 2, background: c.primary }} />}
          <div style={{ width: h.logo_size === "large" ? 30 : 20, height: 7, background: c.ink, borderRadius: 2 }} />
          {h.search_position !== "hidden" && !center && <div style={{ width: 40, height: 7, borderRadius: 4, border: `1px solid ${c.border}`, background: c.surface }} />}
          {h.cart_position !== "left" && <div style={{ width: 8, height: 8, borderRadius: 2, background: c.primary }} />}
        </div>
        <div className={cn("flex gap-1 px-2 py-1.5", t.nav.category_position === "sidebar" && "flex-col")}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              width: 16, height: 5,
              background: t.nav.menu_style === "pill" ? c.primary : c.muted,
              borderRadius: t.nav.menu_style === "pill" ? 4 : 1,
              borderBottom: t.nav.menu_style === "underline" && i === 0 ? `2px solid ${c.primary}` : undefined,
              opacity: i === 0 ? 1 : 0.4,
            }} />
          ))}
          {t.nav.mega_menu && <div style={{ width: 30, height: 14, background: c.surface, border: `1px solid ${c.border}` }} />}
        </div>
      </div>
    );
  }
  if (part === "hero") {
    const h = t.hero;
    return (
      <div style={{ ...box, height: 60 }} className={cn(t.banner.style === "full" ? "p-0" : "p-1.5")}>
        <div style={{ height: "100%", borderRadius: r(h.radius), background: `linear-gradient(135deg, ${c.primary}, ${c.accent})`, position: "relative" }}
          className={cn("flex flex-col justify-center gap-1 px-2", h.text_align === "center" && "items-center", h.text_align === "right" && "items-end")}>
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${h.overlay / 100})`, borderRadius: r(h.radius) }} />
          <div style={{ position: "relative", width: 40, height: 5, background: "rgba(255,255,255,.95)", borderRadius: 2 }} />
          <div style={{ position: "relative", width: 24, height: 7, borderRadius: 3, background: h.cta_style === "outline" ? "transparent" : "rgba(255,255,255,.95)", border: "1px solid rgba(255,255,255,.95)" }} />
        </div>
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
    const update = () => setScale(Math.min(1, Math.max(0.1, (el.clientWidth - 26) / device.w)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device.w]);

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

  const order = resolved.section_order;

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!state?.slug || !active)
    return <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">আগে "Theme & Styling" পেজ থেকে একটি থিম বেছে নিন, তারপর এখানে ডিজাইন করুন।</div>;

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">Theme Studio <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">Beta</span></h1>
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
      </div>

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-2 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1">
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
        </div>

        <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-1.5">
            <span className="mr-auto text-sm font-semibold">লাইভ প্রিভিউ</span>
            {(Object.keys(DEVICES) as Mode[]).map((m) => {
              const Icon = DEVICES[m].icon;
              return (
                <Button key={m} size="sm" className="h-8 px-2.5" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              );
            })}
          </div>
          <div ref={wrapRef} className="flex justify-center rounded-xl border bg-muted/30 p-3">
            <div className="overflow-hidden rounded-lg border bg-background shadow-sm" style={{ width: device.w * scale, height: device.h * scale }}>
              <iframe ref={frameRef} key={mode} title="Store live preview" onLoad={push}
                src={`/store/${state.slug}?${THEME_PREVIEW_PARAM}=1`}
                className="border-0"
                style={{ width: device.w, height: device.h, transform: `scale(${scale})`, transformOrigin: "top left" }} />
            </div>
          </div>
          {local !== null && <p className="text-xs text-muted-foreground">পরিবর্তনগুলো এখনো পাবলিশ হয়নি — Publish চাপলে স্টোরে দেখা যাবে।</p>}
        </div>
      </div>
    </div>
  );
}
