import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function FieldLabel({ children, locked }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="min-w-0 truncate">{children}</span>
      {locked && <Lock className="h-3 w-3 shrink-0" aria-label="Locked by platform" />}
    </Label>
  );
}

export function ColorField({
  label, value, locked, onChange,
}: {
  label: string;
  value: string;
  locked?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel locked={locked}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          disabled={locked}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent disabled:opacity-50"
        />
        <Input
          disabled={locked}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-0 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function SelectField({
  label, value, options, locked, onChange, labels,
}: {
  label: string;
  value: string | number;
  options: readonly (string | number)[];
  locked?: boolean;
  onChange: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel locked={locked}>{label}</FieldLabel>
      <select
        disabled={locked}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm capitalize disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {labels?.[String(o)] ?? String(o).replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SliderField({
  label, value, min, max, step = 1, suffix = "", locked, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  locked?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel locked={locked}>
        {label} — {value}
        {suffix}
      </FieldLabel>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={locked}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary disabled:opacity-50"
      />
    </div>
  );
}

export function SwitchRow({
  label, checked, locked, onChange,
}: {
  label: string;
  checked: boolean;
  locked?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm">{label}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <Switch checked={checked} disabled={locked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
