import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, X, LifeBuoy, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getWebChatHistory, escalateWebChat } from "@/lib/ai-web-chat.functions";
import { useStoreT } from "@/lib/store-i18n";
import { readToken } from "@/lib/customer-session";

type WebProduct = {
  id: string;
  name: string;
  price: number;
  old_price?: number | null;
  stock: number;
  image_url?: string | null;
  product_url?: string | null;
};

function toUi(m: { id: string; role: string; content: string; products?: WebProduct[] }) {
  const products = m.products ?? [];
  return {
    id: m.id,
    role: m.role,
    parts: products.length
      ? [{ type: "tool-showProducts", state: "output-available", output: { products } }]
      : [{ type: "text", text: m.content }],
  };
}

const CID_KEY_PREFIX = "orzen_ai_cid:";
const KEY_PREFIX = "orzen_ai_key:";

const GENERIC_CHAT_ERROR =
  "দুঃখিত, এই মুহূর্তে উত্তর দেওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন। / Sorry, we couldn't reply right now. Please try again.";

/** Turn raw server/network errors (sometimes raw JSON) into a readable message. */
function readableChatError(raw?: string | null): string {
  const text = (raw ?? "").trim();
  if (!text) return GENERIC_CHAT_ERROR;
  try {
    const parsed = JSON.parse(text);
    const msg = typeof parsed?.error === "string" ? parsed.error : "";
    return msg || GENERIC_CHAT_ERROR;
  } catch {
    return text.startsWith("{") || text.length > 200 ? GENERIC_CHAT_ERROR : text;
  }
}

export default function AIChatPanel({
  slug,
  agentName,
  welcome,
  onClose,
}: {
  slug: string;
  agentName: string;
  welcome: string;
  onClose: () => void;
}) {
  const { t } = useStoreT();
  const cidKey = CID_KEY_PREFIX + slug;
  const secretKey = KEY_PREFIX + slug;
  // This browser's private chat key + (optional) signed-in store account.
  const access = () => ({
    chatKey: window.localStorage.getItem(secretKey) ?? undefined,
    customerToken: readToken(slug) ?? undefined,
  });
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(cidKey);
  });
  const [handedOff, setHandedOff] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadHistory = useServerFn(getWebChatHistory);
  const escalate = useServerFn(escalateWebChat);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/ai/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          slug,
          messages,
          conversationId: window.localStorage.getItem(cidKey) ?? undefined,
          ...access(),
        },
      }),
      fetch: async (url, init) => {
        const res = await fetch(url as string, init);
        const cid = res.headers.get("x-orzen-conversation-id");
        const key = res.headers.get("x-orzen-chat-key");
        if (key) window.localStorage.setItem(secretKey, key);
        if (cid) {
          window.localStorage.setItem(cidKey, cid);
          setConversationId(cid);
        }
        return res;
      },
    }),
  ).current;

  const [chatError, setChatError] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string>("");
  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
    onError: (err) => setChatError(readableChatError(err?.message)),
  });

  // Load prior history once per open, if we have a conversation id.
  useEffect(() => {
    if (historyLoaded) return;
    const a = access();
    if (!conversationId && !a.customerToken) {
      setHistoryLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await loadHistory({ data: { slug, conversationId: conversationId ?? undefined, ...a } });
        if (res.conversationId && res.conversationId !== conversationId) {
          window.localStorage.setItem(cidKey, res.conversationId);
          setConversationId(res.conversationId);
        } else if (!res.conversationId && conversationId) {
          // Not this browser's chat (or expired) → start fresh.
          window.localStorage.removeItem(cidKey);
          setConversationId(null);
        }
        if (res.handedOff) setHandedOff(true);
        if (res.messages.length) {
          setMessages(
            res.messages.map(toUi) as UIMessage[],
          );
        }
      } catch {
        /* ignore */
      }
      setHistoryLoaded(true);
    })();
  }, [conversationId, historyLoaded, loadHistory, slug, setMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status, handedOff]);

  const busy = status === "submitted" || status === "streaming";

  // Pull merchant replies from the panel inbox (and notice a takeover).
  useEffect(() => {
    if (!conversationId || !historyLoaded) return;
    const id = setInterval(async () => {
      if (status === "submitted" || status === "streaming") return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await loadHistory({ data: { slug, conversationId, ...access() } });
        setHandedOff(!!res.handedOff);
        if (res.handedOff) {
          setChatError(null);
          setMessages(
            res.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map(toUi) as UIMessage[],
          );
        }
      } catch { /* ignore */ }
    }, handedOff ? 5000 : 15000);
    return () => clearInterval(id);
  }, [conversationId, historyLoaded, handedOff, status, slug, loadHistory, setMessages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setChatError(null);
    setLastText(text);
    if (handedOff) {
      // A person is answering: store the message for the merchant inbox only.
      setMessages([...messages, { id: `local-${Date.now()}`, role: "user", parts: [{ type: "text", text }] } as UIMessage]);
      await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, conversationId, ...access(), messages: [{ id: "u", role: "user", parts: [{ type: "text", text }] }] }),
      }).catch(() => setChatError(GENERIC_CHAT_ERROR));
      return;
    }
    await sendMessage({ text });
  }

  async function retryLast() {
    if (!lastText || busy) return;
    setChatError(null);
    await sendMessage({ text: lastText });
  }

  async function handleEscalate() {
    if (!conversationId || escalating || handedOff) return;
    setEscalating(true);
    try {
      await escalate({ data: { slug, conversationId, ...access() } });
      setHandedOff(true);
    } catch {
      /* ignore */
    }
    setEscalating(false);
  }

  function extractProducts(m: UIMessage): WebProduct[] {
    const products: WebProduct[] = [];
    for (const part of m.parts as any[]) {
      const type = part?.type as string | undefined;
      if (!type) continue;
      // AI SDK emits tool parts as `tool-<name>` with `output`/`result` (varies by version).
      if (type === "tool-showProduct" || type === "tool-showProducts") {
        const out = part.output ?? part.result ?? part.toolResult;
        const list = out?.products;
        if (Array.isArray(list)) products.push(...list);
      }
    }
    return products;
  }

  return (
    <div className="fixed bottom-40 right-4 z-40 flex h-[70vh] max-h-[600px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:w-96 md:bottom-20">
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        <div className="font-semibold">{agentName}</div>
        <div className="flex items-center gap-1">
          {!handedOff && conversationId && (
            <button
              onClick={handleEscalate}
              disabled={escalating}
              title={t("chat.talkToHuman")}
              className="rounded-md p-1.5 hover:bg-white/10 disabled:opacity-50"
            >
              <LifeBuoy className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-md p-1.5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
        {messages.length === 0 && <div className="rounded-lg bg-muted px-3 py-2">{welcome}</div>}
        {messages.map((m) => {
          const text = m.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("");
          const products = m.role === "assistant" ? extractProducts(m) : [];
          const isUser = m.role === "user";
          return (
            <div key={m.id} className="space-y-2">
              {text && (
                <div className={isUser ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3 py-2 text-white"
                        : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2"
                    }
                    style={
                      isUser
                        ? { backgroundColor: "var(--store-btn-bg, var(--primary))" }
                        : undefined
                    }
                  >
                    {text}
                  </div>
                </div>
              )}
              {products.length > 0 && (
                <div className="flex justify-start">
                  <div className="w-full max-w-[95%] space-y-2">
                    {products.map((p) => (
                      <ProductCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {busy && <div className="text-xs text-muted-foreground">{t("chat.typing")}</div>}
        {chatError && !busy && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <div className="whitespace-pre-wrap">{chatError}</div>
            {lastText && (
              <button type="button" onClick={retryLast} className="mt-1 font-medium underline">
                Retry
              </button>
            )}
          </div>
        )}
        {handedOff && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("chat.humanNotified")}
          </div>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={handedOff ? t("chat.waitingForAgent") : t("chat.typeAMessage")}
          disabled={busy}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid h-9 w-9 place-items-center rounded-md text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ProductCard({ p }: { p: WebProduct }) {
  const { t } = useStoreT();
  const inStock = p.stock > 0;
  return (
    <a
      href={p.product_url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex gap-3 rounded-xl border bg-card p-2 shadow-sm transition-shadow hover:shadow-md"
    >
      {p.image_url ? (
        <img
          src={p.image_url}
          alt={p.name}
          loading="lazy"
          className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--store-btn-bg, var(--primary))" }}
            >
              ৳{p.price}
            </span>
            {p.old_price ? (
              <span className="text-xs text-muted-foreground line-through">৳{p.old_price}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-medium ${inStock ? "text-emerald-600" : "text-red-500"}`}
          >
            {inStock ? t("chat.inStock") : t("chat.outOfStock")}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            {t("common.view")} <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </div>
    </a>
  );
}
