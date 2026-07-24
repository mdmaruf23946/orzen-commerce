import { Award, RotateCcw, ShieldCheck, Truck, Wallet } from "lucide-react";

export function TrustBadges({ codEnabled }: { codEnabled: boolean }) {
  const items = [
    { icon: ShieldCheck, label: "Secure Checkout" },
    codEnabled ? { icon: Wallet, label: "Cash on Delivery" } : null,
    { icon: Truck, label: "Fast Delivery" },
    { icon: RotateCcw, label: "Easy Return" },
    { icon: Award, label: "Original Product" },
  ].filter(Boolean) as { icon: typeof ShieldCheck; label: string }[];

  return (
    <section className="mt-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-3">
            <it.icon className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
