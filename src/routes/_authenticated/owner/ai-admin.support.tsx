import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, LifeBuoy, Send } from "lucide-react";
import {
  listSupportRequests,
  getCustomerConversation,
  replyToCustomer,
  setCustomerThreadMode,
  closeSupportRequest,
} from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/support")({ component: Page });

function Conversation({ threadId }: { threadId: string }) {
  const get = useServerFn(getCustomerConversation);
  const reply = useServerFn(replyToCustomer);
  const setMode = useServerFn(setCustomerThreadMode);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["ai-admin", "customer-thread", threadId],
    queryFn: () => get({ data: { thread_id: threadId } }),
    refetchInterval: 15_000,
  });

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await reply({ data: { thread_id: threadId, message: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["ai-admin", "customer-thread", threadId] });
      qc.invalidateQueries({ queryKey: ["ai-admin", "support"] });
      toast.success("Sent to customer");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function backToAi() {
    try {
      await setMode({ data: { thread_id: threadId, mode: "ai" } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "customer-thread", threadId] });
      toast.success("Conversation returned to the AI");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Mode: <Badge variant="outline">{(data?.thread as any)?.status ?? "ai"}</Badge>
        <Button size="sm" variant="outline" className="ml-auto" onClick={backToAi}>
          <Bot className="mr-1 h-3 w-3" /> Return to AI
        </Button>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {(data?.messages ?? []).map((m: any, i: number) => (
          <div
            key={i}
            className={`rounded-md p-2 text-sm ${
              m.role === "user" ? "bg-background" : m.role === "admin" ? "bg-primary/10" : "bg-muted"
            }`}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {m.role === "user" ? "Customer" : m.role === "admin" ? "You" : "AI"} ·{" "}
              {new Date(m.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the customer…" />
        <Button onClick={send} disabled={busy}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Page() {
  const list = useServerFn(listSupportRequests);
  const close = useServerFn(closeSupportRequest);
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["ai-admin", "support"],
    queryFn: () => list(),
    refetchInterval: 20_000,
  });

  async function resolve(id: string) {
    try {
      await close({ data: { id } });
      qc.invalidateQueries({ queryKey: ["ai-admin", "support"] });
      toast.success("Closed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="Customer Support"
        description="Conversations the customer agent escalated to a human. Read the context, reply from here, then hand the chat back to the AI."
      />

      {(data as any[]).length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <LifeBuoy className="mx-auto mb-2 h-6 w-6" />
            No customers are waiting for you.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(data as any[]).map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.customer_name || "Messenger customer"}</span>
                      <Badge
                        variant={r.status === "open" ? "destructive" : r.status === "answered" ? "default" : "secondary"}
                      >
                        {r.status}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">{r.psid}</span>
                    </div>
                    {r.reason ? (
                      <p className="mt-1 text-sm">
                        <span className="font-medium">Reason:</span> {r.reason}
                      </p>
                    ) : null}
                    {r.summary ? <p className="mt-0.5 text-sm text-muted-foreground">{r.summary}</p> : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {r.thread_id ? (
                      <Button size="sm" variant="outline" onClick={() => setOpen(open === r.id ? null : r.id)}>
                        {open === r.id ? "Hide" : "Open chat"}
                      </Button>
                    ) : null}
                    {r.status !== "closed" ? (
                      <Button size="sm" variant="ghost" onClick={() => resolve(r.id)}>
                        Close
                      </Button>
                    ) : null}
                  </div>
                </div>
                {open === r.id && r.thread_id ? <Conversation threadId={r.thread_id} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
