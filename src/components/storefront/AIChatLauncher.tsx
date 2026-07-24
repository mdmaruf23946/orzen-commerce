import { lazy, Suspense, useState } from "react";
import { MessageCircle, X, Bot, Facebook } from "lucide-react";

const AIChatPanel = lazy(() => import("./AIChatPanel"));

export function AIChatLauncher({
  slug,
  agentName,
  welcome,
  messengerUrl,
}: {
  slug: string;
  agentName: string;
  welcome: string;
  messengerUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const hasMessenger = !!messengerUrl;

  function toggle() {
    if (!hasMessenger) {
      setChatOpen((v) => !v);
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <>
      {open && hasMessenger && (
        <div className="fixed bottom-40 right-4 z-40 flex flex-col items-end gap-2 md:bottom-24">
          <button
            onClick={() => {
              setChatOpen(true);
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.02]"
          >
            <Bot className="h-4 w-4" /> AI Chat
          </button>
          <a
            href={messengerUrl!}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.02]"
          >
            <Facebook className="h-4 w-4 text-[#1877F2]" /> Messenger
          </a>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label="Open chat"
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-105 md:bottom-4"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        {open || chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {chatOpen && (
        <Suspense
          fallback={
            <div className="fixed bottom-40 right-4 z-40 grid h-24 w-80 place-items-center rounded-2xl border bg-background text-sm text-muted-foreground shadow-xl md:bottom-20">
              Loading…
            </div>
          }
        >
          <AIChatPanel
            slug={slug}
            agentName={agentName}
            welcome={welcome}
            onClose={() => setChatOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
