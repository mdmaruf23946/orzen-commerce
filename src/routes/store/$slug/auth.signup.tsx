import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { signupCustomer } from "@/lib/customer-auth.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/store/$slug/auth/signup")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ redirect: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Create account" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { slug } = Route.useParams();
  const { redirect } = useSearch({ from: "/store/$slug/auth/signup" });
  const navigate = useNavigate();
  const signup = useServerFn(signupCustomer);
  const { setSession } = useCustomerSession(slug);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    fullName.trim().length >= 1 &&
    (email.trim().length > 0 || phone.trim().length > 0) &&
    password.length >= 6 &&
    password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await signup({
        data: {
          storeSlug: slug,
          fullName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password,
          confirmPassword: confirm,
        },
      });
      setSession(res.token);
      toast.success("Account created");
      if (redirect) navigate({ to: redirect });
      else navigate({ to: "/store/$slug/account", params: { slug } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-lg font-semibold sm:text-xl">Create your account</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Provide at least one of email or phone number.
        </p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirm password</Label>
            <Input
              id="pw2"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
          <Button
            type="submit"
            className="mt-1 h-10 w-full"
            style={{ backgroundColor: "var(--store-btn-bg)", color: "white" }}
            disabled={loading || !canSubmit}
          >
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/store/$slug/auth/login"
            params={{ slug }}
            search={redirect ? { redirect } : undefined}
            className="font-semibold text-foreground hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
