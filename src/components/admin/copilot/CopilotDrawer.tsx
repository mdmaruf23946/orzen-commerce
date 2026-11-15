// AI Business Co-pilot chat drawer (beta; mounted only for beta testers).
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, X, Mic, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { copilotChat, copilotSaveProduct } from "@/lib/copilot/copilot.functions";

type Draft = { name?: string; price?: number; stock?: number; description?: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string; drafts?: Draft[] };

const SUGGESTIONS = [
  "আজকের ও এই মাসের সেলস রিপোর্ট দাও",
  "সবচেয়ে ভালো চলা প্রোডাক্ট কোনগুলো?",
  "স্টোরের এসইও স্কোর ও ভুলগুলো কী কী?",
  "ডেলিভারি ও কুরিয়ার সেটিংস ঠিক আছে কি?",
];

const STORE_KEY = "orzen-copilot-chat-v1";

export function CopilotDrawer() {
  const chat = useServerFn(copilotChat);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) setMsgs(JSON.parse(raw)); } catch {}
    loadedRef.current = true;
  }, []);
  useEffect(() => {
    if (!loadedRef.current) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-60))); } catch {}
  }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  useEffect(() => () => recRef.current?.abort?.(), []);
  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("এই ব্রাউজারে ভয়েস সাপোর্ট নেই। Chrome ব্যবহার করুন।"); return; }
    const rec = new SR();
    rec.lang = "bn-BD"; rec.interimResults = true; rec.continuous = true;
    const base = text ? text.trimEnd() + " " : "";
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(base + t);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed") toast.error("মাইক্রোফোনের অনুমতি দিন");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("ভয়েস বোঝা যায়নি, আবার চেষ্টা করুন");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  async function send(q: string) {
    if (listening) recRef.current?.stop();
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
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:inset-y-4 sm:right-4 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:shadow-2xl">
          <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b px-5 py-3 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15"><Sparkles className="h-4 w-4 text-primary" /></span> Co-pilot <span className="rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Beta</span></SheetTitle>
            {msgs.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => setMsgs([])}>
                <RotateCcw className="h-3 w-3" /> নতুন চ্যাট
              </Button>
            )}
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.content}
                  {m.drafts?.map((d, j) => <DraftCard key={j} draft={d} />)}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> আপনার স্টোরের তথ্য দেখছি…</div>}
            <div ref={endRef} />
          </div>
          <form className="border-t p-4" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <div className="rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={listening ? "বলুন, শুনছি…" : "প্রশ্ন লিখুন বা মাইকে বলুন…"} className="max-h-48 min-h-28 resize-none overflow-y-auto border-0 bg-transparent p-1 text-sm leading-relaxed shadow-none focus-visible:ring-0"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <div className="mt-1 flex items-center justify-end gap-2">
            <Button type="button" size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleVoice}
              aria-label={listening ? "ভয়েস বন্ধ করুন" : "ভয়েসে বলুন"} className={listening ? "animate-pulse" : ""}>
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button type="submit" size="icon" disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
            </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const save = useServerFn(copilotSaveProduct);
  const [name, setName] = useState(String(draft.name ?? ""));
  const [price, setPrice] = useState(String(draft.price ?? ""));
  const [stock, setStock] = useState(String(draft.stock ?? 0));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  async function confirm() {
    if (state !== "idle") return;
    const p = Number(price), st = Math.max(0, Math.floor(Number(stock) || 0));
    if (name.trim().length < 2 || !(p > 0)) { toast.error("নাম ও সঠিক দাম দিন"); return; }
    setState("saving");
    try {
      const r: any = await save({ data: { name: name.trim(), price: p, stock: st, description: draft.description ? String(draft.description) : undefined } });
      setState("saved");
      toast.success(r.duplicate ? "এই নামে প্রোডাক্ট আগে থেকেই আছে" : "প্রোডাক্ট সেভ হয়েছে (খসড়া হিসেবে)");
    } catch (e: any) { setState("idle"); toast.error(e?.message || "সেভ করা যায়নি"); }
  }
  const locked = state !== "idle";
  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="text-xs font-semibold text-muted-foreground">{state === "saved" ? "সংরক্ষিত হয়েছে ✓" : "প্রোডাক্ট খসড়া — যাচাই করে সেভ করুন"}</div>
      <Input value={name} disabled={locked} onChange={(e) => setName(e.target.value)} placeholder="নাম" className="h-8 text-sm" />
      <div className="flex gap-2">
        <Input value={price} disabled={locked} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="দাম ৳" className="h-8 text-sm" />
        <Input value={stock} disabled={locked} onChange={(e) => setStock(e.target.value)} type="number" placeholder="স্টক" className="h-8 text-sm" />
      </div>
      {draft.description ? <div className="text-xs text-muted-foreground">{String(draft.description)}</div> : null}
      <Button size="sm" className="w-full" disabled={locked} onClick={confirm}>
        {state === "saving" ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> সংরক্ষণ হচ্ছে…</> : state === "saved" ? "সংরক্ষিত হয়েছে" : "নিশ্চিত করে সেভ করুন"}
      </Button>
    </div>
  );
}
