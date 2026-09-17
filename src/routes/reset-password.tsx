import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/lib/platform-branding";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — ORZEN" },
      {
        name: "description",
        content: "Choose a new password for your ORZEN merchant account and get back to your dashboard.",
      },
      { property: "og:title", content: "Set a new password — ORZEN" },
      {
        property: "og:description",
        content: "Choose a new password for your ORZEN merchant account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You are signed in.");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Could not update the password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 sm:p-6 shadow-sm">
        <Link to="/" className="flex items-center justify-center">
          <BrandMark placement="auth_login" fallbackText="ORZEN" className="text-sm font-bold tracking-tight" />
        </Link>
        <h1 className="mt-3 text-center text-lg sm:text-xl font-semibold">Set a new password</h1>

        {!ready ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !hasSession ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button asChild className="h-10 w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm.length > 0 && confirm !== password && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>
            <Button type="submit" className="mt-1 h-10 w-full" disabled={loading}>
              {loading ? "Please wait…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
