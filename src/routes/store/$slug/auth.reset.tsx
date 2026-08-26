import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { resetCustomerPassword } from "@/lib/customer-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStoreT } from "@/lib/store-i18n";

export const Route = createFileRoute("/store/$slug/auth/reset")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ token: z.string().optional() }).parse(s),
  head: () => ({ meta: [{ title: "Reset password" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useStoreT();
  const { slug } = Route.useParams();
  const { token } = useSearch({ from: "/store/$slug/auth/reset" });
  const navigate = useNavigate();
  const reset = useServerFn(resetCustomerPassword);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      await reset({ data: { storeSlug: slug, token, password, confirmPassword } });
      toast.success(t("auth.resetDone"));
      navigate({ to: "/store/$slug/auth/login", params: { slug } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-lg font-semibold sm:text-xl">{t("auth.resetTitle")}</h1>
        {!token ? (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-700">
            {t("auth.resetInvalid")}
          </p>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="pw">{t("auth.newPassword")}</Label>
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
              <Label htmlFor="pw2">{t("auth.confirmPassword")}</Label>
              <Input
                id="pw2"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="mt-1 h-10 w-full"
              style={{ backgroundColor: "var(--store-btn-bg)", color: "white" }}
              disabled={loading}
            >
              {loading ? t("common.saving") : t("auth.resetTitle")}
            </Button>
          </form>
        )}
        <Link
          to="/store/$slug/auth/login"
          params={{ slug }}
          className="mt-6 block text-center text-sm font-semibold text-foreground hover:underline"
        >
          {t("auth.backToSignIn")}
        </Link>
      </div>
    </div>
  );
}
