import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { loginCustomer } from "@/lib/customer-auth.functions";
import { useCustomerSession } from "@/lib/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/store/$slug/auth/login")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ redirect: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { slug } = Route.useParams();
  const { redirect } = useSearch({ from: "/store/$slug/auth/login" });
  const navigate = useNavigate();
  const login = useServerFn(loginCustomer);
  const { setSession } = useCustomerSession(slug);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ data: { storeSlug: slug, identifier, password } });
      setSession(res.token);
      toast.success("Welcome back!");
      if (redirect) navigate({ to: redirect });
      else navigate({ to: "/store/$slug/account", params: { slug } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-lg font-semibold sm:text-xl">Sign in</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Use your email or phone number.
        </p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="id">Email or phone</Label>
            <Input
              id="id"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="mt-1 h-10 w-full"
            style={{ backgroundColor: "var(--store-btn-bg)", color: "white" }}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to="/store/$slug/auth/signup"
            params={{ slug }}
            search={redirect ? { redirect } : undefined}
            className="font-semibold text-foreground hover:underline"
          >
            Create one
          </Link>
        </div>
        <div className="mt-2 text-center text-xs">
          <Link
            to="/store/$slug/auth/forgot"
            params={{ slug }}
            className="text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
