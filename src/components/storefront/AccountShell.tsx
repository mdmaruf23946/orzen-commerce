import type { ReactNode } from "react";

export function AccountShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="-mx-4 min-h-[calc(100dvh-3.5rem)] bg-sf-surface px-4 pb-28 pt-4 sm:-mx-6 sm:px-6 md:pb-8">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
