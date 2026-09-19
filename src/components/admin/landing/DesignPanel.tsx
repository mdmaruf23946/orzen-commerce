// Landing Page → Design tab: AI recommended themes, five-role color
// customization with automatic derived states + contrast checking, and save.
// Content / sections / order form are never touched here.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestLandingThemes } from "@/lib/landing-theme.functions";
import {
  COLOR_ROLES,
  DEFAULT_PALETTE,
  contrastReport,
  isHex,
  normalizeHex,
  normalizePalette,
  themeTokens,
  type LandingPalette,
  type LandingThemePreset,
} from "@/lib/landing-theme";

function MiniPreview({ palette }: { palette: LandingPalette }) {
  const t = themeTokens(palette) as Record<string, string>;
  return (
    <div
      className="overflow-hidden rounded-lg border text-[8px] leading-tight"
      style={{ background: t["--lp-bg"], borderColor: t["--lp-border"], color: t["--lp-text"] }}
    >
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ borderBottom: `1px solid ${t["--lp-border"]}` }}
      >
        <span className="font-bold">Store</span>
        <span
          className="rounded px-1.5 py-0.5 font-semibold"
          style={{ background: t["--lp-primary"], color: t["--lp-on-primary"] }}
        >
          Order
        </span>
      </div>
      <div className="space-y-1.5 p-2">
        <div className="h-8 w-full rounded" style={{ background: t["--lp-primary-soft"] }} />
        <div className="h-1.5 w-3/4 rounded" style={{ background: t["--lp-muted"], opacity: 0.5 }} />
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: t["--lp-primary"] }}>৳1,250</span>
          <span
            className="rounded px-1 py-0.5 font-semibold"
            style={{ background: t["--lp-accent"], color: t["--lp-on-accent"] }}
          >
            -20%
          </span>
        </div>
        <div
          className="rounded py-1 text-center font-semibold"
          style={{ background: t["--lp-primary"], color: t["--lp-on-primary"] }}
        >
          Order Now
        </div>
        <div className="h-4 rounded" style={{ background: t["--lp-surface"], border: `1px solid ${t["--lp-border"]}` }} />
      </div>
    </div>
  );
}

function Swatches({ palette }: { palette: LandingPalette }) {
  return (
    <div className="flex gap-1">
      {COLOR_ROLES.map((r) => (
        <span
          key={r.key}
          title={`${r.label} ${palette[r.key]}`}
          className="h-4 w-4 rounded-full border"
          style={{ background: palette[r.key] }}
        />
      ))}
    </div>
  );
}

export function DesignPanel({
  pageId,
  slug,
  theme,
  onChange,
  onSave,
  saving,
}: {
  pageId: string;
  slug: string;
  theme: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
}) {
  const suggestFn = useServerFn(suggestLandingThemes);
  const [nonce, setNonce] = useState(0);

  const saved = useMemo(() => normalizePalette(theme ?? {}), [theme]);
  const [palette, setPalette] = useState<LandingPalette>(saved);
  const [selectedId, setSelectedId] = useState<string>(String((theme as any)?.themeId ?? ""));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setPalette(saved);
    setSelectedId(String((theme as any)?.themeId ?? ""));
  }, [saved, theme]);

  // Themes stored with the page (generated once, at creation). They never
  // change on their own — only an explicit "Regenerate" replaces them.
  const stored: LandingThemePreset[] = Array.isArray((theme as any)?.presets)
    ? ((theme as any).presets as LandingThemePreset[])
    : [];

  // Backfill only: pages created before themes were stored get one generation
  // (also triggered manually via Regenerate, which bumps `nonce`).
  const needsBackfill = stored.length === 0;
  const { data, isFetching } = useQuery({
    queryKey: ["lp-themes", pageId, nonce],
    queryFn: () => suggestFn({ data: { id: pageId } }),
    enabled: needsBackfill || nonce > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const themes: LandingThemePreset[] = stored.length ? stored : (data?.themes ?? []);

  const hasSelection = Boolean((theme as any)?.themeId);

  // Persist a freshly generated list onto the page theme so it stays fixed,
  // applying the first palette when the page has no theme chosen yet.
  useEffect(() => {
    const fresh = data?.themes ?? [];
    if (!fresh.length) return;
    const current = Array.isArray((theme as any)?.presets) ? ((theme as any).presets as LandingThemePreset[]) : [];
    if (current.length && current[0]?.id === fresh[0]?.id) return;

    const base: Record<string, unknown> = {
      ...(theme ?? {}),
      presets: fresh,
      presetsAt: new Date().toISOString(),
    };
    if (!hasSelection) {
      const first = fresh[0]!;
      const next: LandingPalette = {
        primary: first.primary,
        secondary: first.secondary,
        accent: first.accent,
        background: first.background,
        text: first.text,
      };
      setPalette(next);
      setSelectedId(first.id);
      Object.assign(base, next, { themeId: first.id, themeName: first.name });
    }
    onChange(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function apply(next: LandingPalette, id: string, name: string) {
    setPalette(next);
    setSelectedId(id);
    setDrafts({});
    onChange({ ...(theme ?? {}), ...next, themeId: id, themeName: name });
  }

  function setRole(key: keyof LandingPalette, raw: string) {
    setDrafts((d) => ({ ...d, [key]: raw }));
    if (!isHex(raw)) return;
    const next = { ...palette, [key]: normalizeHex(raw, palette[key]) };
    setPalette(next);
    onChange({ ...(theme ?? {}), ...next, themeId: selectedId || "custom", themeName: (theme as any)?.themeName ?? "Custom" });
  }

  const tokens = themeTokens(palette) as Record<string, string>;
  const report = contrastReport(palette);
  const derived: [string, string][] = [
    ["Primary hover", tokens["--lp-primary-hover"]!],
    ["Button label", tokens["--lp-on-primary"]!],
    ["Light background", tokens["--lp-primary-soft"]!],
    ["Border", tokens["--lp-border"]!],
    ["Surface", tokens["--lp-surface"]!],
    ["Muted text", tokens["--lp-muted"]!],
  ];

  return (
    <div className="space-y-4">
      {/* ---- AI recommended themes ---- */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">AI recommended themes</h3>
            <p className="text-xs text-muted-foreground">
              Created once from your product when this page was made. They stay the same.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={isFetching}
            onClick={() => {
              if (themes.length && !window.confirm("Replace the saved themes with a new AI set?")) return;
              setNonce((n) => n + 1);
            }}
          >
            {isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Regenerate themes
          </Button>
        </div>

        {isFetching && !themes.length ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your product…
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {themes.map((t) => {
              const p: LandingPalette = {
                primary: t.primary, secondary: t.secondary, accent: t.accent,
                background: t.background, text: t.text,
              };
              const active = selectedId === t.id;
              return (
                <div
                  key={t.id}
                  className={`space-y-2 rounded-xl border p-3 transition ${active ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <MiniPreview palette={p} />
                  <Swatches palette={p} />
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    className="w-full"
                    onClick={() => apply(p, t.id, t.name)}
                  >
                    {active ? "Selected" : "Select theme"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {!hasSelection && themes.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            The first AI theme is applied as the default — press Save design to keep it.
          </p>
        )}
      </div>

      {/* ---- Customize colors ---- */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Customize colors</h3>
        <p className="text-xs text-muted-foreground">
          Hover, borders, tints and button states are generated automatically.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {COLOR_ROLES.map((r) => (
            <div key={r.key} className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {r.label} <span className="font-normal">— {r.hint}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={palette[r.key]}
                  onChange={(e) => setRole(r.key, e.target.value)}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent"
                />
                <Input
                  value={drafts[r.key] ?? palette[r.key]}
                  onChange={(e) => setRole(r.key, e.target.value)}
                  onBlur={() => setDrafts((d) => ({ ...d, [r.key]: palette[r.key] }))}
                  className="h-9 min-w-0 font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Generated states</div>
          <div className="flex flex-wrap gap-2">
            {derived.map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]">
                <span className="h-3.5 w-3.5 rounded-full border" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {report.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{r.label}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                  r.pass ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {r.ratio.toFixed(1)}:1 · {r.pass ? "Pass" : "Low contrast"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPalette(DEFAULT_PALETTE);
              setDrafts({});
              onChange({ ...(theme ?? {}), ...DEFAULT_PALETTE, themeId: "default", themeName: "Default" });
              setSelectedId("default");
            }}
          >
            Reset to default
          </Button>
          <Button size="sm" onClick={() => onSave()} disabled={saving} className="sm:ml-auto">
            {saving ? "Saving…" : "Save design"}
          </Button>
        </div>
      </div>
    </div>
  );
}
