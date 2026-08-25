import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Check, EyeOff, Loader2, MessageSquare, ShieldCheck, Trash2, X } from "lucide-react";
import {
  listFacebookModeration, decideFacebookModeration, clearFacebookModeration,
} from "@/lib/facebook-page.functions";
import { CAP_SCOPE } from "@/lib/facebook-caps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Section, NotConnected, EmptyState, CapBadge, formatWhen, FB_BLUE } from "@/components/admin/facebook/ui";

type Status = "pending" | "approved" | "rejected" | "failed" | "all";

export const Route = createFileRoute("/_authenticated/admin/facebook/moderation")({
  component: ModerationPage,
  head: () => ({
    meta: [
      { title: "Facebook Moderation Approvals | ORZEN Merchant Panel" },
      {
        name: "description",
        content: "Review and approve AI-suggested Facebook comment replies, hides, deletions and blocks before they run.",
      },
      { property: "og:title", content: "Facebook Moderation Approvals | ORZEN Merchant Panel" },
      { property: "og:description", content: "Nothing is deleted or blocked on your page until you approve it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "failed", label: "Failed" },
  { key: "all", label: "All" },
];

const ACTION_META: Record<string, { label: string; icon: typeof Trash2; cap: string; tone: string }> = {
  reply: { label: "Post a public reply", icon: MessageSquare, cap: "reply_comment", tone: "text-blue-600" },
  hide: { label: "Hide this comment", icon: EyeOff, cap: "hide_comment", tone: "text-amber-600" },
  delete: { label: "Delete this comment", icon: Trash2, cap: "delete_comment", tone: "text-destructive" },
  block: { label: "Block this person", icon: Ban, cap: "block_user", tone: "text-destructive" },
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function ModerationPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFacebookModeration);
  const decideFn = useServerFn(decideFacebookModeration);
  const clearFn = useServerFn(clearFacebookModeration);

  const [status, setStatus] = useState<Status>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["fbpage", "moderation", status],
    queryFn: () => listFn({ data: { status } }),
    refetchInterval: 45_000,
  });

  if (data && !data.connected) return <NotConnected />;

  const caps = (data?.capabilities ?? {}) as Record<string, boolean>;
  const items = (data?.items ?? []) as any[];

  async function decide(id: string, decision: "approve" | "reject", message?: string) {
    setBusyId(id);
    try {
      await decideFn({ data: { id, decision, message: message ?? null } });
      toast.success(decision === "approve" ? "Action applied on Facebook" : "Suggestion rejected");
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section
      title="Moderation approvals"
      description="AI never deletes, hides or blocks on its own — every suggestion waits for your decision here."
      action={
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={async () => {
            await clearFn();
            toast.success("History cleared");
            qc.invalidateQueries({ queryKey: ["fbpage"] });
          }}
        >
          Clear history
        </Button>
      }
    >
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
              status === t.key ? "bg-white text-foreground shadow-sm dark:bg-background" : "hover:bg-background/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6 text-muted-foreground" />}
          title="Nothing waiting for you"
          hint="Run AI review on the Comments page and suggested actions will appear here for approval."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const meta = ACTION_META[it.action] ?? ACTION_META.hide;
            const Icon = meta.icon;
            const allowed = !!caps[meta.cap];
            const busy = busyId === it.id;
            const draft = edits[it.id] ?? it.suggestion ?? "";
            return (
              <li key={it.id} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.tone}`}>
                    <Icon className="h-4 w-4" /> {meta.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLE[it.status] ?? ""}`}>
                    {it.status}
                  </span>
                  {it.category && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">
                      {String(it.category).replace("_", " ")}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{formatWhen(it.created_at)}</span>
                </div>

                <div className="mt-2 flex gap-2.5">
                  {it.author_picture ? (
                    <img src={it.author_picture} alt="" className="h-9 w-9 shrink-0 rounded-full border object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {(it.author_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{it.author_name ?? "Facebook user"}</div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{it.message}</p>
                  </div>
                </div>

                {it.reason && <p className="mt-1.5 text-xs text-muted-foreground">Why: {it.reason}</p>}
                {it.error && <p className="mt-1.5 text-xs text-destructive">{it.error}</p>}

                {it.action === "reply" && it.status === "pending" && (
                  <Textarea
                    rows={2}
                    className="mt-2"
                    value={draft}
                    onChange={(e) => setEdits((d) => ({ ...d, [it.id]: e.target.value }))}
                    placeholder="Edit the AI reply before approving…"
                  />
                )}

                {it.status === "pending" && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        disabled={!allowed || busy || (it.action === "reply" && !draft.trim())}
                        style={{ backgroundColor: FB_BLUE }}
                        onClick={() => decide(it.id, "approve", it.action === "reply" ? draft : undefined)}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                        Approve
                      </Button>
                      <CapBadge ok={allowed} scope={CAP_SCOPE[meta.cap] ?? ""} />
                    </span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(it.id, "reject")}>
                      <X className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
