import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/lib/platform-branding";
import {
  requestPasswordResetCode,
  confirmPasswordResetCode,
  RESEND_COOLDOWN_SEC,
  MAX_SENDS_PER_WINDOW,
} from "@/lib/merchant-security.functions";
import { useResendTimer, CODE_INBOX_HINT } from "@/lib/use-resend-timer";
import { TurnstileWidget, turnstileConfigured, CAPTCHA_WAIT_BN } from "@/components/TurnstileWidget";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ email: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Set a new password — ORZEN" },
      {
        name: "description",
        content: "Enter the 6-digit code sent to your email and choose a new ORZEN password.",
      },
      { property: "og:title", content: "Set a new password — ORZEN" },
      {
        property: "og:description",
        content: "Reset your ORZEN merchant account password with the code sent to your email.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" });
  const [email, setEmail] = useState(search.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const timer = useResendTimer(RESEND_COOLDOWN_SEC, MAX_SENDS_PER_WINDOW);

  const canSubmit =
    email.includes("@") && code.length >= 6 && password.length >= 8 && password === confirm;

  async function resend() {
    if (!timer.canSend) return;
    if (!email.includes("@")) {
      toast.error("Please enter your account email first.");
      return;
    }
    if (turnstileConfigured() && !captcha) {
      toast.error(CAPTCHA_WAIT_BN);
      return;
    }
    setLoading(true);
    try {
      await requestPasswordResetCode({ data: { email: email.trim(), captcha } });
      timer.markSent();
      toast.success("A new code is on its way to your email.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (turnstileConfigured() && !captcha) {
      toast.error(CAPTCHA_WAIT_BN);
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordResetCode({
        data: { email: email.trim(), code: code.trim(), password, captcha },
      });
      toast.success("Password updated. Please sign in with your new password.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <Link to="/" className="flex items-center justify-center">
          <BrandMark
            placement="auth_login"
            fallbackText="ORZEN"
            className="text-sm font-bold tracking-tight"
          />
        </Link>
        <h1 className="mt-3 text-center text-lg font-semibold">Set a new password</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          ইমেইলে পাঠানো ৬ ডিজিট কোড এবং নতুন পাসওয়ার্ড দিন।
        </p>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.4em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirm new password</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
          <Button type="submit" className="h-10 w-full" disabled={loading || !canSubmit}>
            {loading ? "Please wait…" : "Update password"}
          </Button>
        </form>

        <button
          type="button"
          onClick={resend}
          disabled={loading || !timer.canSend}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {timer.limitReached
            ? "Resend limit reached — try again later"
            : timer.secondsLeft > 0
              ? `Resend code in ${timer.secondsLeft}s`
              : `Resend code${timer.sends > 0 ? ` (${timer.sendsLeft} left)` : ""}`}
        </button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          {CODE_INBOX_HINT}
        </p>
        <Link
          to="/auth"
          className="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
