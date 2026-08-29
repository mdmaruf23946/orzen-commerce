import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeeSessionInfo } from "@/lib/employees.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Employee Login</h1>
            <p className="text-xs text-muted-foreground">Sign in to your store's Merchant Panel</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="emp-email">Work email</Label>
            <Input id="emp-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="emp-pass">Password</Label>
            <Input id="emp-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Store owner?{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Merchant login
          </Link>
        </p>
      </div>
    </main>
  );
}
