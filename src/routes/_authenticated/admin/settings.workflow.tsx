import { createFileRoute } from "@tanstack/react-router";
import { OrderConfirmationSection } from "@/components/admin/settings/OrderConfirmationSection";
import { ReturnPolicySection } from "@/components/admin/settings/ReturnPolicySection";
import { ServiceWorkflowSection } from "@/components/admin/settings/ServiceWorkflowSection";

export const Route = createFileRoute("/_authenticated/admin/settings/workflow")({
  head: () => ({
    meta: [
      { title: "Order & Workflow — ORZEN Store Admin" },
      { name: "description", content: "Order confirmation and service workflow settings." },
      { property: "og:title", content: "Order & Workflow — ORZEN Store Admin" },
      { property: "og:description", content: "Order confirmation and service workflow settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderWorkflowPage,
});

function OrderWorkflowPage() {
  return (
    <div className="pb-24">
      <div className="mb-5">
        <h1 className="text-xl font-semibold sm:text-2xl">Order &amp; Workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order confirmation rules and service delivery workflow.
        </p>
      </div>
      <div className="space-y-5">
        <OrderConfirmationSection />
        <ReturnPolicySection />
        <ServiceWorkflowSection />
      </div>
    </div>
  );
}
