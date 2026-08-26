// Shared, user-visible fallback for storefront data/API failures.
// Logs the failure to the runtime error pipeline and offers a retry.
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { trackError } from "@/lib/error-context";
import { useStoreT } from "@/lib/store-i18n";
import { Button } from "@/components/ui/button";

export function StoreErrorState({
  error,
  scope,
  title,
  description,
}: {
  error?: unknown;
  scope: string;
  title?: string;
  description?: string;
}) {
  const { t } = useStoreT();
  const router = useRouter();

  useEffect(() => {
    if (error) trackError(error, scope);
  }, [error, scope]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{title ?? t("error.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description ?? t("error.body")}</p>
      <Button
        variant="outline"
        className="mt-4 gap-2"
        onClick={() => {
          router.invalidate();
          if (typeof window !== "undefined") window.location.reload();
        }}
      >
        <RefreshCw className="h-4 w-4" /> {t("error.retry")}
      </Button>
    </div>
  );
}
