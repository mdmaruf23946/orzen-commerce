import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Send, ShieldCheck, Activity, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { aiGetOverview, aiGetThread, aiSendCommand } from "@/lib/merchant-ai.functions";
import { AgentStatusPill } from "@/components/admin/ai/AgentStatusPill";

export const Route = createFileRoute("/_authenticated/admin/ai/")({
  head: () => ({
    meta: [
      { title: "AI Command Center — ORZEN Merchant Panel" },
      { name: "description", content: "Run your whole store with one AI command centre." },
      { property: "og:title", content: "AI Command Center — ORZEN Merchant Panel" },
      { property: "og:description", content: "Run your whole store with one AI command centre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <CommandCenterPage />
    </FeatureGate>
  ),
});

const SUGGESTIONS = [
  "Today's orders",
  "Find order 01700000000",
  "Which products are running out of stock?",
  "Send order #1001 to courier",
];

function CommandCenterPage() {
  const overviewFn = useServerFn(aiGetOverview);
  const threadFn = useServerFn(aiGetThread);
  const sendFn = useServerFn(aiSendCommand);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: overview } = useQuery({ queryKey: ["ai-cc-overview"], queryFn: () => overviewFn() });
  const { data: thread } = useQuery({ queryKey: ["ai-cc-thread"], queryFn: () => threadFn() });

  const messages = thread?.messages ?? [];

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages.length, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy]);

  async function send(value?: string) {
    const body = (value ?? text).trim();
    if (!body || busy) return;
    setBusy(true);
    setText("");
    try {
      await sendFn({ data: { text: body } });
      await qc.invalidateQueries({ queryKey: ["ai-cc-thread"] });
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const agents = overview?.agents ?? [];
  const pending = overview?.pending ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bot className="h-6 w-6" /> AI Command Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One brain for your whole store. Ask in plain language — the right agents do the work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/ai/approvals">
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Approvals{pending.length ? ` (${pending.length})` : ""}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/ai/logs">
              <Activity className="mr-1.5 h-4 w-4" /> Activity
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Master agent chat */}
        <div className="flex min-h-[520px] flex-col rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Master AI Agent</span>
          </div>
          <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Give a command and the Master Agent will use your order, customer, product and courier agents.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m: any, i: number) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                      : "max-w-[95%] whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <p className="animate-pulse text-sm text-muted-foreground">Working on it…</p>}
          </div>
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="e.g. Verify Rahim's order and send it to courier"
                className="min-h-[44px] resize-none"
                rows={1}
              />
              <Button onClick={() => send()} disabled={busy || !text.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Agents + approvals */}
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-amber-500" /> Waiting for your approval
              </div>
              <ul className="space-y-2">
                {pending.slice(0, 4).map((p: any) => (
                  <li key={p.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="font-medium">{p.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.summary}</div>
                  </li>
                ))}
              </ul>
              <Button asChild size="sm" className="mt-3 w-full">
                <Link to="/admin/ai/approvals">Review approvals</Link>
              </Button>
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-medium">Agents</span>
              <Link to="/admin/ai/agents" className="text-xs text-primary hover:underline">
                Manage
              </Link>
            </div>
            <ul className="divide-y">
              {agents.map((a: any) => (
                <li key={a.key} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.description}</div>
                  </div>
                  <AgentStatusPill status={a.status} />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Recent activity
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {(overview?.logs ?? []).slice(0, 6).map((l: any) => (
                <li key={l.id} className="truncate">
                  {new Date(l.created_at).toLocaleTimeString()} — {l.message}
                </li>
              ))}
              {(overview?.logs ?? []).length === 0 && <li>No activity yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
