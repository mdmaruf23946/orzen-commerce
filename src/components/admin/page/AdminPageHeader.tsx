import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {action && <div className="hidden shrink-0 items-center gap-2 sm:flex">{action}</div>}
    </div>
  );
}
