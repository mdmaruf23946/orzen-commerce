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
      { title: "Inventory — ORZEN Merchant Panel" },
      { name: "description", content: "Stock, downloads, service capacity and subscriber analytics in one dynamic inventory page." },
      { property: "og:title", content: "Inventory — ORZEN Merchant Panel" },
      { property: "og:description", content: "Stock, downloads, service capacity and subscriber analytics in one dynamic inventory page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }), => ({ key: t, label: PRODUCT_TYPE_LABEL[t] }))}
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
