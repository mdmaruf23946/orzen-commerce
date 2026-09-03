// Landing Page → Coding tab.
//
// The merchant edits the real CSS the public landing page uses to render the
// sections created in the Content tab. This layer is presentation only: it
// cannot touch content, orders, payments, customers or settings.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fixLandingDesignCode, setLandingDesignCode } from "@/lib/landing-builder.functions";
import { autoFixDesignCode, defaultDesignCode, designHooks, validateDesignCode } from "@/lib/landing-code";
import type { LandingContent } from "@/lib/landing-builder";

export const LP_DRAFT_CODE_KEY = (slug: string) => `lp-draft-code:${slug}`;

export function CodingPanel({
  pageId,
  slug,
  content,
  savedCode,
  onSaved,
}: {
  pageId: string;
  slug: string;
  content: LandingContent;
  savedCode: string | null;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(setLandingDesignCode);
  const fixFn = useServerFn(fixLandingDesignCode);

  const sections = useMemo(
    () => content.sectionOrder.filter((k) => content.sectionEnabled[k] !== false),
    [content.sectionOrder, content.sectionEnabled],
  );
  const fallback = useMemo(() => defaultDesignCode(sections), [sections]);

  const [code, setCode] = useState<string>(savedCode || fallback);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCode(savedCode || fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCode]);

  const check = useMemo(() => validateDesignCode(code), [code]);
  const lineCount = useMemo(() => code.split("\n").length, [code]);

  function writeDraft(value: string) {
    try {
      sessionStorage.setItem(LP_DRAFT_CODE_KEY(slug), value);
    } catch {
      /* preview draft is best-effort only */
    }
  }

  async function save() {
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setSaving(true);
    try {
      await saveFn({ data: { id: pageId, code } });
      // The preview iframe reads this draft key, so it always shows exactly
      // what was just saved — no stale stylesheet.
      writeDraft(code);
      toast.success("Design code saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function fixWithAi() {
    setFixing(true);
    setFixNote(null);
    try {
      // 1) Deterministic repair — handles fences, stray markup, disallowed
      //    declarations and unbalanced braces without any round-trip.
      const local = repairDesignCode(code);
      if (local.ok) {
        setCode(local.code);
        setFixNote("Fixed automatically — the code is valid now. Press “Save code” to apply it.");
        toast.success("Code repaired — press Save code to apply it");
        return;
      }

      // 2) AI repair, then verify the result instead of trusting it.
      const res = (await fixFn({
        data: { id: pageId, code, error: check.ok ? "" : check.error },
      })) as { code: string };
      const verified = repairDesignCode(res.code || code);
      if (verified.ok) {
        setCode(verified.code);
        setFixNote("AI repaired the code — it is valid now. Press “Save code” to apply it.");
        toast.success("AI repaired the design code — press Save code to apply it");
        return;
      }

      setCode(verified.code);
      setFixNote(null);
      toast.error(`Could not fully repair the code: ${verified.error ?? "still invalid"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFixing(false);
    }
  }



  function reset() {
    if (!confirm("Replace the current design code with the system default design?")) return;
    setCode(fallback);
    toast.success("Default design restored — press Save code to apply it");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Frontend design code</h3>
            <p className="text-xs text-muted-foreground">
              This CSS styles the sections from the Content tab. It controls layout, spacing,
              typography, cards, buttons, images and animation only — never content, orders or settings.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1 h-3 w-3" /> Reset to default
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !check.ok}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              Save code
            </Button>
          </div>
        </div>

        {/* status strip */}
        <div className="mt-3">
          {check.ok ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5 shrink-0" />
              Valid design code · {lineCount} lines
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {check.error}
                {check.line ? ` (line ${check.line})` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={fixWithAi} disabled={fixing}>
                {fixing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                Fix with AI
              </Button>
            </div>
          )}
        </div>

        {/* editor */}
        <div className="mt-3 overflow-hidden rounded-lg border bg-neutral-950">
          <div className="flex max-h-[560px] overflow-hidden">
            <div
              ref={gutterRef}
              className="select-none overflow-hidden border-r border-neutral-800 bg-neutral-900 px-2 py-3 text-right font-mono text-[11px] leading-5 text-neutral-500"
              aria-hidden
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={taRef}
              value={code}
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
              onScroll={() => {
                if (gutterRef.current && taRef.current) {
                  gutterRef.current.scrollTop = taRef.current.scrollTop;
                }
              }}
              onKeyDown={(e) => {
                if (e.key !== "Tab") return;
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: s, selectionEnd: en } = el;
                const next = `${code.slice(0, s)}  ${code.slice(en)}`;
                setCode(next);
                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
              }}
              className="h-[560px] w-full resize-none bg-neutral-950 p-3 font-mono text-[12px] leading-5 text-neutral-100 outline-none"
              aria-label="Landing page design code"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Every rule is automatically scoped to this landing page. Scripts, imports and external
          resources are blocked. Maximum 60 KB.
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="text-sm font-semibold">Style hooks on this page</h3>
        <p className="text-xs text-muted-foreground">
          These selectors exist on this landing page right now. Click one to insert it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {designHooks(sections).map((h) => (
            <button
              key={h.selector}
              type="button"
              title={h.label}
              onClick={() => setCode((c) => `${c.trimEnd()}\n\n${h.selector} {\n  \n}\n`)}
              className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] hover:bg-muted"
            >
              {h.selector}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
