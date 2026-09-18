import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { requestCustomerPasswordReset } from "@/lib/customer-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStoreT } from "@/lib/store-i18n";
import { TurnstileWidget } from "@/components/TurnstileWidget";


export const Route = createFileRoute("/store/$slug/auth/forgot")({
  head: () => ({ meta: [{ title: "Forgot password" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const { t } = useStoreT();
  const { slug } = Route.useParams();
  const request = useServerFn(requestCustomerPasswordReset);
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captcha, setCaptcha] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await request({ data: { storeSlug: slug, identifier, captcha } });

      setSent(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-lg font-semibold sm:text-xl">{t("auth.forgotTitle")}</h1>
        {sent ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-800">
            {t("auth.resetSent")}
          </p>
        ) : (
          <>
            <p className="mt-2 text-center text-xs text-muted-foreground">{t("auth.forgotBody")}</p>
            <form className="mt-5 space-y-3" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="ident">{t("auth.emailOrPhone")}</Label>
                <Input
                  id="ident"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <TurnstileWidget onToken={setCaptcha} className="flex justify-center" />
              <Button

                type="submit"
                className="mt-1 h-10 w-full"
                style={{ backgroundColor: "var(--store-btn-bg)", color: "white" }}
                disabled={loading}
              >
                {loading ? t("common.saving") : t("auth.sendResetLink")}
              </Button>
            </form>
          </>
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
