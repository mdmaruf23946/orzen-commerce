import { createFileRoute } from "@tanstack/react-router";
import { updateProductDefaults } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/product-defaults")({
  component: ProductDefaultsPage,
});

const defaults = {
  warranty: "",
  return_policy: "",
  shipping_info: "",
};

function ProductDefaultsPage() {
  return (
    <SettingsPage
      title="Product Defaults"
      description="Prefilled when you create a new product. Each product can still be edited individually."
      column="product_defaults"
      save={updateProductDefaults}
      defaults={defaults}
    >
      {(form, set) => (
        <>
          <div className="space-y-1.5">
            <Label>Default Warranty</Label>
            <Textarea rows={3} value={form.warranty ?? ""} onChange={(e) => set("warranty", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Default Return Policy</Label>
            <Textarea
              rows={3}
              value={form.return_policy ?? ""}
              onChange={(e) => set("return_policy", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Shipping Information</Label>
            <Textarea
              rows={3}
              value={form.shipping_info ?? ""}
              onChange={(e) => set("shipping_info", e.target.value)}
            />
          </div>
        </>
      )}
    </SettingsPage>
  );
}
