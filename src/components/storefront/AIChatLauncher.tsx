import { lazy, Suspense, useEffect, useState } from "react";

// Taps that land before React hydrates would otherwise do nothing. This tiny
// inline script runs as soon as the HTML is parsed, remembers the tap, and the
// component replays it the moment it mounts.
const EARLY_TAP_SCRIPT =
  "(function(){try{function m(e){if(window.__orzenChatReady)return;var n=e.target;while(n&&n!==document){if(n.dataset&&n.dataset.chatLauncher){window.__orzenChatTap=1;try{window.dispatchEvent(new CustomEvent('orzen-chat-tap'))}catch(_){}break}n=n.parentNode}}document.addEventListener('pointerdown',m,true);document.addEventListener('click',m,true)}catch(_){}})()";
import { Bot, MessageCircle, X } from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";
import { Button } from "@/components/ui/button";
import { MessengerMark } from "@/components/admin/brand/MessengerMark";
import { WhatsAppMark } from "@/components/admin/brand/WhatsAppMark";

const AIChatPanel = lazy(() => import("./AIChatPanel"));

export function AIChatLauncher({
  slug,
  aiAgent,
  messengerUrl,
  whatsappUrl,
}: {
  slug: string;
  aiAgent?: { agentName: string; welcome: string } | null;
  messengerUrl?: string | null;
  whatsappUrl?: string | null;
}) {
  const { t } = useStoreT();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const hasAi = !!aiAgent;
  const hasMessenger = !!messengerUrl;
  const hasWhatsapp = !!whatsappUrl;
  const channelCount = Number(hasAi) + Number(hasMessenger) + Number(hasWhatsapp);

  function toggle() {
    if (chatOpen) setChatOpen(false);
    setOpen((v) => !v);
  }

  // Replay a tap that happened before hydration, then hand control back to
  // React's own onClick so post-hydration clicks toggle normally.
  useEffect(() => {
    const w = window as any;
    if (w.__orzenChatTap) {
      w.__orzenChatTap = 0;
      setOpen(true);
    }
    w.__orzenChatReady = 1;
    return () => {
      w.__orzenChatReady = 0;
    };
  }, []);

  if (channelCount === 0) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-40 right-5 z-40 flex flex-col items-center gap-3 md:bottom-24">
          {hasAi && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={t("chat.aiChatLabel")}
              title={t("chat.aiChatLabel")}
              onClick={() => {
                setChatOpen(true);
                setOpen(false);
              }}
              className="h-12 w-12 rounded-full border-sf-line bg-sf-card text-sf-ink shadow-lg sf-animate-slide-up sf-press hover:scale-105 hover:bg-sf-card [&_svg]:!size-6"
            >
              <Bot className="h-6 w-6" />
              <span className="sr-only">{t("chat.aiChatLabel")}</span>
            </Button>
          )}
          {hasMessenger && (
            <a
              href={messengerUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              aria-label={t("chat.messenger")}
              title={t("chat.messenger")}
              className="flex h-12 w-12 items-center justify-center rounded-full sf-animate-slide-up sf-press shadow-lg transition-transform hover:scale-105"
            >
              <MessengerMark size={48} className="rounded-full" />
              <span className="sr-only">{t("chat.messenger")}</span>
            </a>
          )}
          {hasWhatsapp && (
            <a
              href={whatsappUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              aria-label="WhatsApp"
              title="WhatsApp"
              className="flex h-12 w-12 items-center justify-center rounded-full sf-animate-slide-up sf-press shadow-lg transition-transform hover:scale-105"
            >
              <WhatsAppMark size={48} className="rounded-full" />
              <span className="sr-only">WhatsApp</span>
            </a>
          )}
        </div>
      )}

      <script dangerouslySetInnerHTML={{ __html: EARLY_TAP_SCRIPT }} />

      <Button
        type="button"
        size="icon"
        data-chat-launcher="1"
        onClick={toggle}
        aria-label={t("chat.openChat")}
        aria-expanded={open}
        className="sf-press sf-float fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full text-primary-foreground shadow-lg hover:scale-110 hover:shadow-xl md:bottom-4 [&_svg]:!size-6"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        {open || chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {chatOpen && aiAgent && (
        <Suspense
          fallback={
            <div className="fixed bottom-40 right-4 z-40 grid h-24 w-80 place-items-center rounded-2xl border bg-background text-sm text-muted-foreground shadow-xl md:bottom-20">
              {t("common.loading")}
            </div>
          }
        >
          <AIChatPanel
            slug={slug}
            agentName={aiAgent.agentName}
            welcome={aiAgent.welcome}
            onClose={() => setChatOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
