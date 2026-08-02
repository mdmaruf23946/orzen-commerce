// Shared UI primitives for the dedicated Service product form.
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StepCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Unlimited list of plain strings. */
export function RepeatableList({
  value,
  onChange,
  placeholder,
  addLabel = "Add item",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row}
            placeholder={placeholder}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}

export function ServiceWizard({
  tabs,
  saving,
  editing,
  onSubmit,
  onCancel,
  onSaveDraft,
  footerInfo,
}: {
  tabs: ReadonlyArray<{ id: string; label: string; content: React.ReactNode }>;
  saving: boolean;
  editing: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  footerInfo: React.ReactNode;
}) {
  const [rawStep, setStep] = useState(0);
  const total = tabs.length;
  const step = Math.min(rawStep, total - 1);
  const current = tabs[step];
  const isLast = step === total - 1;
  const progress = Math.round(((step + 1) / total) * 100);

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] sm:text-xs">
          <span className="truncate pr-2 font-medium">
            Step {step + 1}/{total} — <span className="text-primary">{current.label}</span>
          </span>
          <span className="shrink-0 text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="mt-2 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setStep(i)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors sm:px-3 sm:text-[11px] ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {done && <Check className="mr-1 inline h-3 w-3" />}
                {i + 1}. {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div key={current.id}>{current.content}</div>
      </div>

      <div className="shrink-0 border-t bg-muted/30 p-2.5 sm:p-4">
        <p className="mb-2 hidden text-xs text-muted-foreground sm:block">{footerInfo}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex-1 sm:flex-none sm:size-default"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {isLast ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={onSaveDraft}
                className="flex-1 sm:flex-none sm:size-default"
              >
                Save draft
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="flex-1 sm:flex-none sm:size-default">
                {saving ? "Saving…" : editing ? "Save service" : "Publish service"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep(Math.min(total - 1, step + 1))}
              className="flex-1 sm:flex-none sm:size-default"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
