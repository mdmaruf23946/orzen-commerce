import type { ReactNode } from "react";

export function AccountShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="-mx-4 min-h-[calc(100dvh-3.5rem)] bg-neutral-50 px-4 py-4 sm:-mx-6 sm:px-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
