// AI Business Co-pilot chat drawer (beta; mounted only for beta testers).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { copilotChat } from "@/lib/copilot/copilot.functions";

type Draft = { name?: string; price?: number; stock?: number; description?: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string; drafts?: Draft[] };

const SUGGESTIONS = [
  "আজকের ও এই মাসের সেলস রিপোর্ট দাও",
  "সবচেয়ে ভালো চলা প্রোডাক্ট কোনগুলো?",
  "স্টোরের এসইও স্কোর ও ভুলগুলো কী কী?",
  "ডেলিভারি ও কুরিয়ার সেটিংস ঠিক আছে কি?",
];

export function CopilotDrawer() {
  const chat = useServerFn(copilotChat);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(q: string) {
    const content = q.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r: any = await chat({ data: { messages: next.slice(-20).map(({ role, content }) => ({ role, content })) } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply || "…", drafts: r.drafts }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: e?.message || "Co-pilot এখন ব্যস্ত, একটু পরে চেষ্টা করুন।" }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="AI Business Co-pilot"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90">
        <Sparkles className="h-4 w-4" /> Co-pilot
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Business Co-pilot <span className="rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Beta</span></SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">আপনার স্টোরের আসল তথ্য দেখে পরামর্শ দেব। কী জানতে চান?</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.content}
                  {m.drafts?.map((d, j) => (
                    <div key={j} className="mt-2 rounded-lg border bg-card p-3 text-card-foreground">
                      <div className="text-xs font-semibold text-muted-foreground">প্রোডাক্ট খসড়া (এখনো সেভ হয়নি)</div>
                      <div className="font-medium">{String(d.name ?? "")}</div>
                      <div className="text-xs">দাম: ৳{String(d.price ?? "-")} · স্টক: {String(d.stock ?? "-")}</div>
                      {d.description ? <div className="mt-1 text-xs text-muted-foreground">{String(d.description)}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> আপনার স্টোরের তথ্য দেখছি…</div>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="প্রশ্ন লিখুন…" className="min-h-10 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <Button type="submit" size="icon" disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
