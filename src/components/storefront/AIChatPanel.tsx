import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";

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
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { slug },
    }),
  ).current;
  const { messages, sendMessage, status } = useChat({ transport });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="fixed bottom-40 right-4 z-40 flex h-[70vh] max-h-[600px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:w-96 md:bottom-20">
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: "var(--store-btn-bg, var(--primary))" }}
      >
        <div className="font-semibold">{agentName}</div>
        <button onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
        {messages.length === 0 && (
          <div className="rounded-lg bg-muted px-3 py-2">{welcome}</div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p: any) => (p.type === "text" ? p.text : ""))
            .join("");
          if (!text) return null;
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  isUser
                    ? "max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-white"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2"
                }
                style={isUser ? { backgroundColor: "var(--store-btn-bg, var(--primary))" } : undefined}
              >
                {text}
              </div>
            </div>
          );
        })}
        {busy && <div className="text-xs text-muted-foreground">Typing…</div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
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
