import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-sf-accent-soft text-sf-accent">
        {icon ?? <ShoppingBag className="h-5 w-5" />}
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-900">{title}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
