import type { ReactNode } from "react";

export function OwnerPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:gap-3 md:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight break-words sm:text-lg md:text-2xl sm:truncate">{title}</h1>
        {description && <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs md:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
