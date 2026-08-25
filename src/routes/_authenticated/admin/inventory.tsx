import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { AdminPageHeader } from "@/components/admin/page/AdminPageHeader";
import { TypeFilterTabs } from "@/components/admin/page/TypeFilterTabs";
import { Input } from "@/components/ui/input";
import { useProductTypeScope, PRODUCT_TYPES, PRODUCT_TYPE_LABEL, type ProductTypeOnly } from "@/lib/product-type-scope";
import { PhysicalInventory } from "@/components/admin/inventory/PhysicalInventory";
import { DigitalInventory } from "@/components/admin/inventory/DigitalInventory";
import { ServiceInventory } from "@/components/admin/inventory/ServiceInventory";
import { SubscriptionInventory } from "@/components/admin/inventory/SubscriptionInventory";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: () => (
    <FeatureGate feature="inventory">
      <InventoryPage />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Inventory · Merchant Panel" },
      {
        name: "description",
        content: "Stock, downloads, service capacity and subscriber analytics in one dynamic inventory page.",
      },
    ],
  }),
});

const DESCRIPTIONS: Record<ProductTypeOnly, string> = {
  physical: "Stock levels, value, alerts and every stock movement.",
  digital: "Sales, downloads, licenses and file versions.",
  service: "Capacity, bookings and service order flow.",
  subscription: "Subscribers, renewals and recurring revenue.",
};

function InventoryPage() {
  const { scope, setScope, activeType } = useProductTypeScope();
  const type: ProductTypeOnly = scope === "all" ? activeType : scope;
  const [q, setQ] = useState("");

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Inventory" description={DESCRIPTIONS[type]} />

      <TypeFilterTabs
        tabs={PRODUCT_TYPES.map((t) => ({ key: t, label: PRODUCT_TYPE_LABEL[t] }))}
        value={type}
        onChange={(k) => setScope(k)}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${PRODUCT_TYPE_LABEL[type].toLowerCase()} products…`}
          className="pl-9"
        />
      </div>

      {type === "physical" && <PhysicalInventory search={q} />}
      {type === "digital" && <DigitalInventory search={q} />}
      {type === "service" && <ServiceInventory search={q} />}
      {type === "subscription" && <SubscriptionInventory search={q} />}
    </div>
  );
}
