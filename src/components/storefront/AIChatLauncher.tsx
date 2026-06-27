import { lazy, Suspense, useState } from "react";
import { MessageCircle, X } from "lucide-react";

const AIChatPanel = lazy(() => import("./AIChatPanel"));

export function AIChatLauncher({ slug, agentName, welcome }: { slug: string; agentName: string; welcome: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat"
        className="fixed bottom-4 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open && (
        <Suspense
          fallback={
            <div className="fixed bottom-20 right-4 z-40 grid h-24 w-80 place-items-center rounded-2xl border bg-background text-sm text-muted-foreground shadow-xl">
              Loading…
            </div>
          }
        >
          <AIChatPanel slug={slug} agentName={agentName} welcome={welcome} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
