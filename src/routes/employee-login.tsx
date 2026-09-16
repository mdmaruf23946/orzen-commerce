import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeeSessionInfo } from "@/lib/employees.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/lib/platform-branding";
import { isInvalidAuthSessionError } from "@/lib/deployment-target";

export const Route = createFileRoute("/employee-login")({
  component: EmployeeLogin,
  head: () => ({
    meta: [
      { title: "Employee Login — ORZEN" },
      { name: "description", content: "Sign in to your store's Merchant Panel with your ORZEN employee account." },
      { property: "og:title", content: "Employee Login — ORZEN" },
      { property: "og:description", content: "Sign in to your store's Merchant Panel with your ORZEN employee account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EmployeeLogin() {
  const navigate = useNavigate();
  const session = useServerFn(employeeSessionInfo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
      const info = (await session()) as any;
      if (!info?.ok) {
        await supabase.auth.signOut();
        throw new Error(
          info?.reason === "inactive_employee"
            ? "Your employee account is not active. Ask your merchant to activate it."
            : "This is a merchant account. Please sign in from the Merchant login page.",
        );
      }
      toast.success(`Welcome back, ${info.staff.name}`);
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      if (isInvalidAuthSessionError(err)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        toast.error("Your sign-in session could not be verified. Please sign in again.");
      } else {
        toast.error("Your account was signed in, but its access could not be checked. Please try again.");
      }
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
        <h1 className="mt-3 text-center text-lg font-semibold sm:text-xl">Employee login</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Sign in to your store's Merchant Panel
        </p>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Work email</Label>
            <Input
              id="emp-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-pass">Password</Label>
            <Input
              id="emp-pass"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="mt-1 h-10 w-full" disabled={loading}>
            {loading ? "Please wait…" : "Sign in"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="outline" className="h-10 w-full">
          <Link to="/auth">
            <Store className="mr-2 h-4 w-4" />
            Merchant login
          </Link>
        </Button>
      </div>
    </div>
  );
}
