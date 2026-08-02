import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AdminToolbar({
  value,
  onChange,
  placeholder,
  action,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Primary action, shown full-width on mobile (hidden on desktop where the header holds it). */
  action?: ReactNode;
  /** Optional right-side control such as a sort select. */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {action && <div className="[&>button]:min-h-10 [&>button]:w-full sm:hidden">{action}</div>}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 pl-9"
        />
      </div>
      {trailing}
    </div>
  );
}
