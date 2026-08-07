import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { StoreSeo } from "@/lib/seo";

export type SeoOverview = {
  store: any;
  storeUrl: string;
  categories: string[];
  productCount: number;
  categoryCount: number;
};

export type TabProps = {
  form: StoreSeo;
  set: <K extends keyof StoreSeo>(k: K, v: StoreSeo[K]) => void;
  overview: SeoOverview;
  saving: boolean;
  onSave: (keys: (keyof StoreSeo)[]) => void;
};

export function SeoCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SaveBar({
  saving,
  onSave,
  label = "Save changes",
}: {
  saving: boolean;
  onSave: () => void;
  label?: string;
}) {
  return (
    <Button type="button" onClick={onSave} disabled={saving} className="w-full sm:w-auto">
      {saving ? "Saving…" : label}
    </Button>
  );
}

export function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = (value ?? "").length;
  const good = n >= min && n <= max;
  return (
    <p className={`text-xs ${n === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-amber-600"}`}>
      {n} / {max} characters{n === 0 ? " · automatic value will be used" : good ? "" : ` · best ${min}–${max}`}
    </p>
  );
}
