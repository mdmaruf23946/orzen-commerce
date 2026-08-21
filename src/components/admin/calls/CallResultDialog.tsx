import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCallOutcome } from "@/lib/call-center.functions";
import {
  CALL_RESULTS, RESULT_LABEL, STATUS_LABEL, type CallResult, type CallStatus,
} from "@/lib/call-center";

const MANUAL_STATUSES: CallStatus[] = ["completed", "answered", "missed", "busy", "no_answer", "failed"];

/** Fast post-call capture: status (manual mode), result chip and one-line note. */
export function CallResultDialog({
  open, onOpenChange, callId, manualStatus = false, phone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  callId: string | null;
  /** Device mode has no provider events — ask the admin for the outcome. */
  manualStatus?: boolean;
  phone?: string;
}) {
  const save = useServerFn(updateCallOutcome);
  const qc = useQueryClient();
  const [status, setStatus] = useState<CallStatus>("completed");
  const [result, setResult] = useState<CallResult | null>(null);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus("completed");
      setResult(null);
      setMinutes("");
      setSeconds("");
      setNote("");
    }
  }, [open]);

  async function submit() {
    if (!callId) return;
    setSaving(true);
    try {
      const duration = Number(minutes || 0) * 60 + Number(seconds || 0);
      await save({
        data: {
          callId,
          ...(manualStatus ? { status } : {}),
          ...(duration > 0 ? { duration_sec: duration } : {}),
          result,
          note: note.trim() || null,
        },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["calls"] }),
        qc.invalidateQueries({ queryKey: ["call-center"] }),
        qc.invalidateQueries({ queryKey: ["order-calls"] }),
        qc.invalidateQueries({ queryKey: ["phone-calls"] }),
      ]);
      toast.success("Call saved");
      onOpenChange(false);
    } catch {
      toast.error("Could not save the call. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Call result{phone ? ` · ${phone}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {manualStatus && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Call status</div>
              <div className="flex flex-wrap gap-1.5">
                {MANUAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-lg border px-2.5 py-1 text-xs ${status === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Result</div>
            <div className="flex flex-wrap gap-1.5">
              {CALL_RESULTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(result === r ? null : r)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${result === r ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  {RESULT_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Duration (optional)</div>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="mm"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="h-9 w-20"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                inputMode="numeric"
                placeholder="ss"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="h-9 w-20"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Note (optional)</div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Customer confirmed delivery address"
              maxLength={500}
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Skip
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
