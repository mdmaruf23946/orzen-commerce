import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGlobalGeminiKeys, playgroundChat } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean; meta?: string };

export function KeyPlayground() {
  const listFn = useServerFn(listGlobalGeminiKeys);
  const chatFn = useServerFn(playgroundChat);
  const { data } = useQuery({ queryKey: ["ai", "gemini-keys"], queryFn: () => listFn() as any });
  const keys: any[] = (data as any)?.keys ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const allSelected = keys.length > 0 && selected.length === keys.length;
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function send() {
    const msg = text.trim();
    if (!msg || selected.length === 0 || busy) return;
    setText("");
    setBusy(true);
    const histories: Record<string, { role: "user" | "assistant"; content: string }[]> = {};
    for (const id of selected) {
      histories[id] = (threads[id] ?? []).filter((m) => !m.error).slice(-10).map(({ role, content }) => ({ role, content }));
    }
    setThreads((t) => {
      const n = { ...t };
      for (const id of selected) n[id] = [...(n[id] ?? []), { role: "user", content: msg }];
      return n;
    });
    try {
      const r: any = await chatFn({ data: { ids: selected, messages: [{ role: "user", content: msg }], histories } });
      setThreads((t) => {
        const n = { ...t };
        for (const res of r.results) {
          const meta = `${(res.ms / 1000).toFixed(1)}s${res.model ? ` · ${res.model}` : ""}${res.tokens ? ` · ${res.tokens} token` : ""}`;
          n[res.id] = [
            ...(n[res.id] ?? []),
            res.ok
              ? { role: "assistant", content: res.text, meta }
              : { role: "assistant", content: res.error || "ব্যর্থ", error: true, meta },
          ];
        }
        return n;
      });
    } catch (e) {
      setThreads((t) => {
        const n = { ...t };
        for (const id of selected) n[id] = [...(n[id] ?? []), { role: "assistant", content: (e as Error).message, error: true }];
        return n;
      });
    } finally {
      setBusy(false);
    }
  }

  const shown = keys.filter((k) => selected.includes(k.id));

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">API Key Test Chat</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(allSelected ? [] : keys.map((k) => k.id))}>
            {allSelected ? "সব বাদ দিন" : "সব key একসাথে"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setThreads({})} title="চ্যাট মুছুন">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">যে key টেস্ট করতে চান সেটা বেছে নিন (একটা বা একাধিক), তারপর মেসেজ পাঠান।</p>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">কোনো API key যুক্ত নেই।</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keys.map((k, i) => {
            const on = selected.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggle(k.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"} ${k.enabled ? "" : "opacity-60"}`}
              >
                {i + 1}. {k.label || k.provider}
              </button>
            );
          })}
        </div>
      )}

      {shown.length > 0 && (
        <div className={`grid gap-3 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}>
          {shown.map((k) => {
            const msgs = threads[k.id] ?? [];
            const last = [...msgs].reverse().find((m) => m.role === "assistant");
            return (
              <div key={k.id} className="min-w-0 rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <span className="truncate text-sm font-medium">{k.label || k.provider}</span>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : last ? (
                    last.error ? (
                      <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> কাজ করছে না</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> কাজ করছে</span>
                    )
                  ) : null}
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                  {msgs.length === 0 && <p className="text-xs text-muted-foreground">এখনো কোনো মেসেজ নেই।</p>}
                  {msgs.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                      <div
                        className={`max-w-[90%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : m.error
                              ? "border border-destructive/40 bg-destructive/10 text-destructive"
                              : "bg-muted text-foreground"
                        }`}
                      >
                        {m.content}
                        {m.meta && <div className="mt-1 text-[10px] opacity-70">{m.meta}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={selected.length ? "কিছু লিখে পাঠান…" : "আগে উপরে থেকে key বেছে নিন"}
          rows={2}
          className="min-w-0 flex-1"
        />
        <Button onClick={send} disabled={busy || !text.trim() || selected.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
