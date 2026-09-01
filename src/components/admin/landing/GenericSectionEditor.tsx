// Registry-driven editor used by every non-builtin landing page section.
// Merchants edit content, images and icons only — never design.
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { lpImage } from "@/lib/landing-builder";
import type { LPFieldSpec, LPSectionSpec } from "@/lib/landing-sections";
import { SectionShell } from "./section-editors";

type BlockData = Record<string, any>;

function MediaField({
  label, value, onChange, storeId, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  storeId?: string;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={lpImage(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted-foreground">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <ImageUploader
            storeId={storeId}
            folder={storeId ? `${storeId}/landing` : undefined}
            value={value || null}
            onChange={(p) => onChange(p ?? "")}
            label={value ? "Change image" : "Upload image"}
          />
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {options.slice(0, 10).map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => onChange(img)}
                  title="Choose existing image"
                  className={`h-10 w-10 overflow-hidden rounded border ${value === img ? "ring-2 ring-primary" : ""}`}
                >
                  <img src={lpImage(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScalarField({
  spec, value, onChange, storeId, productImages,
}: {
  spec: LPFieldSpec;
  value: any;
  onChange: (v: string) => void;
  storeId?: string;
  productImages: string[];
}) {
  if (spec.type === "image") {
    return (
      <MediaField
        label={spec.label}
        value={String(value ?? "")}
        onChange={onChange}
        storeId={storeId}
        options={productImages}
      />
    );
  }
  if (spec.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{spec.label}</Label>
        <Textarea
          rows={4}
          value={String(value ?? "")}
          maxLength={spec.max}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{spec.label}</Label>
      <Input
        value={String(value ?? "")}
        maxLength={spec.max}
        placeholder={spec.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ListField({
  spec, items, onChange, storeId, productImages,
}: {
  spec: Extract<LPFieldSpec, { type: "list" }>;
  items: BlockData[];
  onChange: (items: BlockData[]) => void;
  storeId?: string;
  productImages: string[];
}) {
  function update(i: number, key: string, value: string) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{spec.label}</Label>
        <span className="text-[11px] text-muted-foreground">
          {items.length}/{spec.maxItems}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {spec.itemLabel} {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete ${spec.itemLabel} ${i + 1}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {spec.fields.map((f) =>
              f.type === "list" ? null : (
                <ScalarField
                  key={f.key}
                  spec={f}
                  value={item[f.key]}
                  onChange={(v) => update(i, f.key, v)}
                  storeId={storeId}
                  productImages={productImages}
                />
              ),
            )}
          </div>
        ))}
      </div>
      {items.length < spec.maxItems && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, {}])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add {spec.itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

export function GenericSectionEditor({
  spec, data, onChange, onBack, onSave, saving, storeId, productImages = [],
}: {
  spec: LPSectionSpec;
  data: BlockData;
  onChange: (next: BlockData) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  storeId?: string;
  productImages?: string[];
}) {
  return (
    <SectionShell name={spec.name} onBack={onBack} onSave={onSave} saving={saving}>
      <p className="text-xs text-muted-foreground">{spec.description}</p>
      {spec.note && (
        <p className="rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">{spec.note}</p>
      )}
      {spec.fields.map((f) =>
        f.type === "list" ? (
          <ListField
            key={f.key}
            spec={f}
            items={Array.isArray(data[f.key]) ? (data[f.key] as BlockData[]) : []}
            onChange={(items) => onChange({ ...data, [f.key]: items })}
            storeId={storeId}
            productImages={productImages}
          />
        ) : (
          <ScalarField
            key={f.key}
            spec={f}
            value={data[f.key]}
            onChange={(v) => onChange({ ...data, [f.key]: v })}
            storeId={storeId}
            productImages={productImages}
          />
        ),
      )}
    </SectionShell>
  );
}
