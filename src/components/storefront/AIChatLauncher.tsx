import { lazy, Suspense, useEffect, useState } from "react";
import { Bot, MessageCircle, X } from "lucide-react";
import { useStoreT } from "@/lib/store-i18n";
import { Button } from "@/components/ui/button";
import { MessengerMark } from "@/components/admin/brand/MessengerMark";
import { WhatsAppMark } from "@/components/admin/brand/WhatsAppMark";

const AIChatPanel = lazy(() => import("./AIChatPanel"));

// The whole menu ships inside the first HTML response and is hidden with CSS,
// so opening it never waits for React to hydrate.
const LAUNCHER_CSS = `
#orzen-chat-menu[data-open="0"]{display:none}
#orzen-chat-launcher .orzen-ico-close{display:none}
#orzen-chat-launcher[data-open="1"] .orzen-ico-close{display:flex}
#orzen-chat-launcher[data-open="1"] .orzen-ico-open{display:none}
`;

// Runs while the HTML is still parsing: taps toggle the menu through plain DOM
// so the button is interactive from the first painted frame.
const EARLY_TAP_SCRIPT = `(function(){try{
function el(id){return document.getElementById(id)}
function set(v){var m=el('orzen-chat-menu'),b=el('orzen-chat-launcher');if(m)m.setAttribute('data-open',v);if(b){b.setAttribute('data-open',v);b.setAttribute('aria-expanded',v==='1'?'true':'false')}window.__orzenChatOpen=v==='1'?1:0}
function hit(e,attr){var n=e.target;while(n&&n!==document){if(n.dataset&&n.dataset[attr])return n;n=n.parentNode}return null}
function onTap(e){
  if(hit(e,'chatAi')){window.__orzenChatAiTap=1;set('0');return}
  if(hit(e,'chatLauncher')){if(window.__orzenChatReady)return;set(window.__orzenChatOpen?'0':'1')}
}
document.addEventListener('click',onTap,true)
}catch(_){}})()`;

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
    if (chatOpen) {
      setChatOpen(false);
      setOpen(false);
      return;
    }
    setOpen((v) => !v);
  }

  // Adopt whatever state the pre-hydration script left behind, then take over.
  useEffect(() => {
    const w = window as any;
    if (w.__orzenChatAiTap) {
      w.__orzenChatAiTap = 0;
      setChatOpen(true);
      setOpen(false);
    } else if (w.__orzenChatOpen) {
      setOpen(true);
    }
    w.__orzenChatReady = 1;
    return () => {
      w.__orzenChatReady = 0;
    };
  }, []);

  useEffect(() => {
    (window as any).__orzenChatOpen = open ? 1 : 0;
  }, [open]);

  if (channelCount === 0) return null;

  const openFlag = open ? "1" : "0";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LAUNCHER_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: EARLY_TAP_SCRIPT }} />

      <div
        id="orzen-chat-menu"
        data-open={openFlag}
        className="fixed bottom-40 right-5 z-40 flex flex-col items-center gap-3 md:bottom-24"
      >
        {hasAi && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            data-chat-ai="1"
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

      <Button
        type="button"
        size="icon"
        id="orzen-chat-launcher"
        data-chat-launcher="1"
        data-open={open || chatOpen ? "1" : "0"}
        onClick={toggle}
        aria-label={t("chat.openChat")}
        aria-expanded={open || chatOpen}
        className="sf-press sf-float fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full text-primary-foreground shadow-lg hover:scale-110 hover:shadow-xl md:bottom-4 [&_svg]:!size-6"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        <span className="orzen-ico-open flex items-center justify-center">
          <MessageCircle className="h-6 w-6" />
        </span>
        <span className="orzen-ico-close flex items-center justify-center">
          <X className="h-6 w-6" />
        </span>
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
