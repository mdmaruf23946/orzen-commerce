// Small shared field atoms for the AI Product Builder steps.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function Grid({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {children}
    </div>
  );
}

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
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 text-muted-foreground">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <Input
        type="number"
        min={0}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
      <span className="text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
