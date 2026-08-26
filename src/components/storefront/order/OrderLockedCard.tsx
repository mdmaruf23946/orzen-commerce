// Shown when someone opens an order link without ownership proof.
// The server only returns the order status in that case, so instead of
// crashing we ask for the phone/email used on the order.
import { useState } from "react";
import { Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { writeOrderContact } from "@/lib/order-proof";
import { useStoreT } from "@/lib/store-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrderLockedCard({
  order,
  slug,
  onVerify,
}: {
  order: any;
  slug: string;
  onVerify: (contact: string) => void;
}) {
  const { t } = useStoreT();
  const [value, setValue] = useState("");

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl border bg-card p-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-lg font-semibold">{t("order.locked.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("order.locked.body")}</p>

        <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="text-xs uppercase text-muted-foreground">{t("order.summary.id")}</div>
          <div className="font-mono">{String(order?.id ?? "").slice(0, 8).toUpperCase()}</div>
          {order?.status && (
            <div className="mt-1 text-xs uppercase text-muted-foreground">{order.status}</div>
          )}
        </div>

        <form
          className="mt-4 space-y-2 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            const v = value.trim();
            if (!v) return;
            writeOrderContact(order.id, v);
            onVerify(v);
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("order.locked.placeholder")}
            autoComplete="tel"
          />
          <Button type="submit" className="w-full">
            {t("order.locked.verify")}
          </Button>
        </form>

        <Link
          to="/store/$slug"
          params={{ slug }}
          className="mt-4 inline-block text-sm text-muted-foreground underline"
        >
          {t("order.continueShopping")}
        </Link>
      </div>
    </div>
  );
}
