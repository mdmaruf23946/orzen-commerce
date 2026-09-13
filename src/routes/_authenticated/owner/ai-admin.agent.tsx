import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, Send, X } from "lucide-react";
import {
  runAiAdminCommand,
  listAiAdminThreads,
  listAiAdminMessages,
  listAiAdminPending,
  decideAiAdminPending,
} from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/agent")({ component: Page });

const EXAMPLES = [
  "How many users registered today?",
  "Show pending subscription payments",
  "Rahim-এর প্ল্যান Premium করো",
  "Change order INV-1001 status to delivered",
];

function Page() {
  const run = useServerFn(runAiAdminCommand);
  const threadsFn = useServerFn(listAiAdminThreads);
  const messagesFn = useServerFn(listAiAdminMessages);
  const pendingFn = useServerFn(listAiAdminPending);
  const decideFn = useServerFn(decideAiAdminPending);
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState<string | null>(null);

  const { data: threads = [] } = useQuery({ queryKey: ["ai-admin", "threads"], queryFn: () => threadsFn() });
  const { data: messages = [] } = useQuery({
    queryKey: ["ai-admin", "messages", thread],
    queryFn: () => messagesFn({ data: { thread_id: thread! } }),
    enabled: !!thread,
  });
  const { data: pending = [] } = useQuery({ queryKey: ["ai-admin", "pending"], queryFn: () => pendingFn() });
  const waiting = (pending as any[]).filter((p) => p.status === "pending");

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await run({ data: { text } });
      setText("");
      toast.success("Command processed");
      qc.invalidateQueries({ queryKey: ["ai-admin"] });
      if (!thread) {
        const list = (await threadsFn()) as any[];
        const console_ = list.find((t) => String(t.wa_id).startsWith("console:"));
        if (console_) setThread(console_.id);
      }
      if (res?.reply) toast.message(res.reply.slice(0, 300));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, approve: boolean) {
    try {
      await decideFn({ data: { id, approve } });
      toast.success(approve ? "Action executed" : "Action cancelled");
      qc.invalidateQueries({ queryKey: ["ai-admin"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="AI Agent"
        description="Give natural-language admin commands in English or Bengali. No fixed syntax needed."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Send a command</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={3}
              placeholder="e.g. Show today's revenue"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((x) => (
                <Button key={x} size="sm" variant="outline" onClick={() => setText(x)}>{x}</Button>
              ))}
            </div>
            <Button disabled={busy || !text.trim()} onClick={send}>
              <Send className="mr-1 h-4 w-4" /> {busy ? "Thinking…" : "Send"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Awaiting confirmation</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {waiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            ) : (
              waiting.map((p) => (
                <div key={p.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.summary}</span>
                    <Badge variant={p.risk === "high" ? "destructive" : "secondary"}>{p.risk}</Badge>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => decide(p.id, true)}><Check className="mr-1 h-3 w-3" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(p.id, false)}>
                      <X className="mr-1 h-3 w-3" />Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversations</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {(threads as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              (threads as any[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThread(t.id)}
                  className={`w-full rounded-md border p-2 text-left text-sm ${thread === t.id ? "bg-muted" : ""}`}
                >
                  <div className="font-medium">{t.display_name || t.wa_id}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.last_message_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversation history</CardTitle></CardHeader>
          <CardContent>
            {!thread ? (
              <p className="text-sm text-muted-foreground">Select a conversation.</p>
            ) : (
              <ScrollArea className="h-80 pr-3">
                <div className="space-y-2">
                  {(messages as any[]).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md border p-2 text-sm ${m.role === "assistant" ? "bg-muted/50" : ""}`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {m.role === "assistant" ? <Bot className="h-3 w-3" /> : null}
                        {m.role} · {new Date(m.created_at).toLocaleString()} · {m.channel}
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {Array.isArray(m.actions) && m.actions.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.actions.map((a: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{a}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
