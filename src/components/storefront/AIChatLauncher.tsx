import { lazy, Suspense, useState } from "react";
import { MessageCircle, X, Bot, Facebook } from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";

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
  const { t } = useStoreT();
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
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 sf-animate-slide-up sf-press shadow-lg ring-1 ring-black/5 hover:scale-[1.03]"
          >
            <Bot className="h-4 w-4" /> {t("chat.aiChatLabel")}
          </button>
          <a
            href={messengerUrl!}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 sf-animate-slide-up sf-press shadow-lg ring-1 ring-black/5 hover:scale-[1.03]"
          >
            <Facebook className="h-4 w-4 text-[#1877F2]" /> {t("chat.messenger")}
          </a>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={t("chat.openChat")}
        className="sf-press sf-float fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg hover:scale-110 hover:shadow-xl md:bottom-4"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        {open || chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {chatOpen && (
        <Suspense
          fallback={
            <div className="fixed bottom-40 right-4 z-40 grid h-24 w-80 place-items-center rounded-2xl border bg-background text-sm text-muted-foreground shadow-xl md:bottom-20">
              {t("common.loading")}
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
