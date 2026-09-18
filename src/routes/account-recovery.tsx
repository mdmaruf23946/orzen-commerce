import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/lib/platform-branding";
import { recoverWithBackupCode } from "@/lib/merchant-security.functions";

export const Route = createFileRoute("/account-recovery")({
  head: () => ({
    meta: [
      { title: "Account recovery — ORZEN" },
      {
        name: "description",
        content:
          "Lost your authenticator phone? Use an ORZEN backup code to turn off two-factor and sign in again.",
      },
      { property: "og:title", content: "Account recovery — ORZEN" },
      {
        property: "og:description",
        content: "Recover access to your ORZEN merchant account with a backup code.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await recoverWithBackupCode({ data: { email: email.trim(), password, code } });
      toast.success("Two-factor turned off. Please sign in and turn it on again from Settings.");
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
        <h1 className="mt-3 text-center text-lg font-semibold">Use a backup code</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          ইমেইল, পাসওয়ার্ড ও একটি ব্যাকআপ কোড দিলে টু-ফ্যাক্টর বন্ধ হয়ে যাবে।
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
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc">Backup code</Label>
            <Input
              id="bc"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX"
              className="text-center font-mono tracking-widest"
            />
          </div>
          <Button type="submit" className="h-10 w-full" disabled={loading}>
            {loading ? "Please wait…" : "Recover my account"}
          </Button>
        </form>
        <Link
          to="/auth"
          className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
