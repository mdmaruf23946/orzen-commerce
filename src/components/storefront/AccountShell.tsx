import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function AccountShell({
  slug,
  title,
  children,
}: {
  slug: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100dvh-3.5rem)] bg-neutral-50 sm:-mx-6">
      <div className="sticky top-14 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 px-3">
          <Link
            to="/store/$slug"
            params={{ slug }}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold text-neutral-900">{title}</h1>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">{children}</div>
    </div>
  );
}
