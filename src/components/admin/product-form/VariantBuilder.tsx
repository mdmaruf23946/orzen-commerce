import { useState } from "react";
import { Plus, Trash2, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type VariantItem = {
  id: string;
  options: Record<string, string>;
  sku?: string | null;
  price?: number | null;
  discount?: number | null;
  stock?: number | null;
  barcode?: string | null;
  image?: string | null;
};
export type VariantsV2 = { options: { name: string; values: string[] }[]; items: VariantItem[] };

const PRESETS = [
  "Size", "Color", "Material", "Fabric", "Net Weight", "Volume", "Flavor",
  "Pack Size", "Storage", "RAM", "Model", "Shade", "Fragrance", "Finish",
];

export function buildMatrix(options: VariantsV2["options"], existing: VariantItem[]): VariantItem[] {
  const opts = options.filter((o) => o.name.trim() && o.values.length);
  if (!opts.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const opt of opts) {
    const next: Record<string, string>[] = [];
    for (const c of combos) for (const v of opt.values) next.push({ ...c, [opt.name]: v });
    combos = next;
  }
  return combos.slice(0, 500).map((o) => {
    const id = Object.values(o).join("::");
    const prior = existing.find((e) => e.id === id);
    return prior ? { ...prior, options: o } : { id, options: o, sku: null, price: null, discount: null, stock: 0, barcode: null, image: null };
  });
}

export function VariantBuilder({
  variants,
  setVariants,
  excluded,
  setExcluded,
  images,
  basePrice,
}: {
  variants: VariantsV2;
  setVariants: (fn: (v: VariantsV2) => VariantsV2) => void;
  excluded: string[];
  setExcluded: (v: string[]) => void;
  images: string[];
  basePrice: number;
}) {
  const enabled = variants.options.length > 0;
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  function setOptions(fn: (o: VariantsV2["options"]) => VariantsV2["options"]) {
    setVariants((v) => {
      const options = fn(v.options);
      return { options, items: buildMatrix(options, v.items) };
    });
  }
  function toggle(on: boolean) {
    if (on) setOptions(() => [{ name: "Size", values: [] }]);
    else if (confirm("সব variant মুছে যাবে। নিশ্চিত?")) {
      setVariants(() => ({ options: [], items: [] }));
      setExcluded([]);
    }
  }
  function addOption(name = "") {
    if (variants.options.length >= 6) return;
    if (name && variants.options.some((o) => o.name.toLowerCase() === name.toLowerCase())) return;
    setOptions((o) => [...o, { name, values: [] }]);
  }
  function addValues(i: number, raw: string) {
    const vals = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return;
    setOptions((o) =>
      o.map((x, idx) => (idx === i ? { ...x, values: Array.from(new Set([...x.values, ...vals])).slice(0, 50) } : x)),
    );
    setDrafts((d) => ({ ...d, [i]: "" }));
  }
  function updateItem(id: string, patch: Partial<VariantItem>) {
    setVariants((v) => ({ ...v, items: v.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function applyBulk() {
    setVariants((v) => ({
      ...v,
      items: v.items.map((it) => ({
        ...it,
        ...(bulkPrice !== "" ? { price: Number(bulkPrice) } : {}),
        ...(bulkStock !== "" ? { stock: Math.max(0, Math.floor(Number(bulkStock))) } : {}),
      })),
    }));
  }

  const activeCount = variants.items.filter((i) => !excluded.includes(i.id)).length;

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span>
            <span className="block text-sm font-medium">এই পণ্যের কি Variant আছে?</span>
            <span className="block text-xs text-muted-foreground">যেমন Size, Color, Weight, Flavor — না থাকলে বন্ধ রাখুন</span>
          </span>
        </span>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </label>

      {enabled && (
        <>
          {variants.options.map((opt, i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
              <div className="flex gap-2">
                <Input
                  value={opt.name}
                  list="variant-presets"
                  onChange={(e) => {
                    const name = e.target.value.slice(0, 60);
                    setOptions((o) => o.map((x, idx) => (idx === i ? { ...x, name } : x)));
                  }}
                  placeholder="Variant নাম (যেমন Size)"
                  className="h-9 font-medium"
                />
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setOptions((o) => o.filter((_, idx) => idx !== i))} aria-label="Remove variant">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opt.values.map((val) => (
                  <span key={val} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
                    {val}
                    <button type="button" aria-label={`Remove ${val}`} onClick={() => setOptions((o) => o.map((x, idx) => (idx === i ? { ...x, values: x.values.filter((v) => v !== val) } : x)))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={drafts[i] ?? ""}
                  onChange={(e) => {
                    const t = e.target.value;
                    if (t.endsWith(",")) addValues(i, t);
                    else setDrafts((d) => ({ ...d, [i]: t }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addValues(i, drafts[i] ?? "");
                    }
                  }}
                  placeholder="Value লিখে Enter চাপুন (যেমন M, L, XL)"
                  className="h-9"
                />
                <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => addValues(i, drafts[i] ?? "")}>
                  Add
                </Button>
              </div>
            </div>
          ))}
          <datalist id="variant-presets">
            {PRESETS.map((p) => <option key={p} value={p} />)}
          </datalist>

          {variants.options.length < 6 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">আরেকটি Variant যোগ করুন:</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.filter((p) => !variants.options.some((o) => o.name.toLowerCase() === p.toLowerCase()))
                  .slice(0, 8)
                  .map((p) => (
                    <button key={p} type="button" onClick={() => addOption(p)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">
                      + {p}
                    </button>
                  ))}
                <button type="button" onClick={() => addOption("")} className="rounded-full border border-primary/40 px-2.5 py-1 text-xs text-primary hover:bg-primary/10">
                  <Plus className="mr-0.5 inline h-3 w-3" />Custom
                </button>
              </div>
            </div>
          )}

          {variants.items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Combinations ({activeCount}/{variants.items.length})</p>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg bg-muted/30 p-2">
                <Input className="h-8" type="number" min={0} placeholder={`সবার দাম (${basePrice || "৳"})`} value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
                <Input className="h-8" type="number" min={0} placeholder="সবার স্টক" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} />
                <Button type="button" size="sm" variant="secondary" className="h-8" onClick={applyBulk}>সবাইকে দিন</Button>
              </div>
              <ul className="space-y-2">
                {variants.items.map((it) => {
                  const off = excluded.includes(it.id);
                  return (
                    <li key={it.id} className={`rounded-lg border p-2.5 ${off ? "opacity-50" : ""}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{Object.values(it.options).join(" / ")}</span>
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {off ? "বন্ধ" : "চালু"}
                          <Switch
                            checked={!off}
                            onCheckedChange={(on) => setExcluded(on ? excluded.filter((x) => x !== it.id) : [...excluded, it.id])}
                          />
                        </label>
                      </div>
                      {!off && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Input className="h-8" type="number" min={0} placeholder={`দাম ${basePrice || ""}`} value={it.price ?? ""} onChange={(e) => updateItem(it.id, { price: e.target.value === "" ? null : Number(e.target.value) })} />
                          <Input className="h-8" type="number" min={0} placeholder="স্টক" value={it.stock ?? ""} onChange={(e) => updateItem(it.id, { stock: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))) })} />
                          <Input className="h-8" placeholder="SKU" value={it.sku ?? ""} onChange={(e) => updateItem(it.id, { sku: e.target.value.slice(0, 60) })} />
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={it.image ?? ""}
                            onChange={(e) => updateItem(it.id, { image: e.target.value || null })}
                          >
                            <option value="">ছবি: মূল ছবি</option>
                            {images.map((img, n) => (
                              <option key={img} value={img}>ছবি {n + 1}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">দাম খালি রাখলে মূল দাম ব্যবহার হবে। দরকার নেই এমন combination বন্ধ করে দিন।</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
