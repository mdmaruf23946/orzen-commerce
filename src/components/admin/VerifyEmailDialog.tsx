import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  requestEmailCode,
  confirmEmailCode,
  RESEND_COOLDOWN_SEC,
  MAX_SENDS_PER_WINDOW,
} from "@/lib/merchant-security.functions";
import { useRefreshSecurity } from "@/lib/use-security";
import { useResendTimer, CODE_INBOX_HINT } from "@/lib/use-resend-timer";

export function VerifyEmailDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email?: string | null;
}) {
  const request = useServerFn(requestEmailCode);
  const confirm = useServerFn(confirmEmailCode);
  const refresh = useRefreshSecurity();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useResendTimer(RESEND_COOLDOWN_SEC, MAX_SENDS_PER_WINDOW);

  async function send() {
    if (!timer.canSend) return;
    setBusy(true);
    try {
      const res = (await request()) as { alreadyVerified?: boolean };
      if (res?.alreadyVerified) {
        toast.success("Your email is already verified");
        refresh();
        onOpenChange(false);
        return;
      }
      setSent(true);
      timer.markSent();
      toast.success("We sent a 6-digit code to your email");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await confirm({ data: { code } });
      toast.success("Email verified — your account is fully unlocked");
      refresh();
      onOpenChange(false);
      setSent(false);
      setCode("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5" /> Verify your email
          </DialogTitle>
          <DialogDescription>
            {sent
              ? `Enter the 6-digit code we sent to ${email ?? "your email"}. It expires in 10 minutes.`
              : `We will send a 6-digit code to ${email ?? "your account email"}.`}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <Button onClick={send} disabled={busy || !timer.canSend} className="w-full">
            {busy ? "Sending…" : "Send code"}
          </Button>
        ) : (
          <form className="space-y-3" onSubmit={verify}>
            <div className="space-y-1.5">
              <Label htmlFor="vcode">Verification code</Label>
              <Input
                id="vcode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
              {busy ? "Verifying…" : "Verify email"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={send}
              disabled={busy}
            >
              Resend code
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
