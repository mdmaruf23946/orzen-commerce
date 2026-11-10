// Facebook comment view inside Omni Inbox: thread (comment + reply box) and the
// right-side panel that shows which post the comment was made on.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Globe, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import {
  replyFacebookComment, privateReplyFacebookComment, setFacebookCommentHidden, deleteFacebookComment,
} from "@/lib/integrations/facebook-page.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function FacebookCommentThread({ comment, onDone }: { comment: any; onDone?: () => void }) {
  const qc = useQueryClient();
  const replyFn = useServerFn(replyFacebookComment);
  const privFn = useServerFn(privateReplyFacebookComment);
  const hideFn = useServerFn(setFacebookCommentHidden);
  const delFn = useServerFn(deleteFacebookComment);
  const [mode, setMode] = useState<"public" | "messenger">("public");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["omni-fb-comments"] });
      return true;
    } catch (e) {
      toast.error((e as Error).message || "কাজটি করা যায়নি");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const message = draft.trim();
    if (!message) return;
    const ok =
      mode === "public"
        ? await run("send", () => replyFn({ data: { comment_id: comment.comment_id, message } }), "Public reply দেওয়া হয়েছে")
        : await run("send", () => privFn({ data: { comment_id: comment.comment_id, message } }), "Messenger-এ পাঠানো হয়েছে");
    if (ok) setDraft("");
  }

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3 sm:p-4">
        <div className="flex justify-start">
          <div className={cn("max-w-[85%] rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-sm shadow-sm sm:max-w-[70%]", comment.hidden && "opacity-60")}>
            <div className="mb-0.5 text-xs font-semibold">{comment.author_name || "Facebook user"}</div>
            <div className="whitespace-pre-wrap break-words">{comment.message || "—"}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Public comment · {comment.comment_created_at ? new Date(comment.comment_created_at).toLocaleString() : ""}
              {comment.hidden && " · Hidden"}
            </div>
          </div>
        </div>
        {comment.replied && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground shadow-sm">উত্তর দেওয়া হয়েছে ✓</div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={!!busy}
            onClick={() => run("hide", () => hideFn({ data: { comment_id: comment.comment_id, hidden: !comment.hidden } }), comment.hidden ? "Comment দেখানো হচ্ছে" : "Comment hide করা হয়েছে")}>
            {comment.hidden ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}
            {comment.hidden ? "Unhide" : "Hide"}
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} className="text-destructive"
            onClick={async () => {
              if (!confirm("Comment-টি Facebook থেকে মুছে ফেলবেন?")) return;
              if (await run("del", () => delFn({ data: { comment_id: comment.comment_id } }), "Comment মুছে ফেলা হয়েছে")) onDone?.();
            }}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="border-t bg-card p-2 sm:p-3">
        <div className="mb-2 flex gap-1.5">
          <button type="button" onClick={() => setMode("public")}
            className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs", mode === "public" ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground")}>
            <Globe className="h-3.5 w-3.5" /> পাবলিক কমেন্টে রিপ্লাই
          </button>
          <button type="button" onClick={() => setMode("messenger")}
            className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs", mode === "messenger" ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground")}>
            <MessageCircle className="h-3.5 w-3.5" /> মেসেঞ্জারে ইনবক্স করুন
          </button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea rows={1} value={draft} className="max-h-32 min-h-10 resize-none"
            placeholder={mode === "public" ? "সবার সামনে উত্তর লিখুন…" : "Messenger-এ ব্যক্তিগত মেসেজ লিখুন…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <Button onClick={send} disabled={busy === "send" || !draft.trim()} size="icon" className="h-10 w-10 shrink-0" aria-label="পাঠান">
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );
}

export function FacebookPostPanel({ comment, onClose }: { comment: any; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b p-4">
        <div className="font-semibold">কোন post-এ comment করেছে</div>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="বন্ধ করুন"><X className="h-4 w-4" /></Button>
        )}
      </div>
      <div className="p-4">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-3 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Facebook Page post
          </div>
          <p className="whitespace-pre-wrap break-words p-3 text-sm">{comment.post_excerpt || "Post-এর লেখা পাওয়া যায়নি"}</p>
          {comment.post_id && (
            <a href={`https://facebook.com/${comment.post_id}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 border-t p-3 text-xs font-medium text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Facebook-এ post দেখুন
            </a>
          )}
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">Comment করেছেন</div>
          <div className="font-medium">{comment.author_name || "Facebook user"}</div>
          <div className="text-xs text-muted-foreground">
            {comment.comment_created_at ? new Date(comment.comment_created_at).toLocaleString() : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
