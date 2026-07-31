import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTemplatesManager } from "@/components/invoice/InvoiceTemplatesManager";

export const Route = createFileRoute("/_authenticated/admin/invoice-templates")({
  component: () => <InvoiceTemplatesManager scope="store" />,
  head: () => ({
    meta: [
      { title: "Invoice Templates — ORZEN Store Admin" },
      { name: "description", content: "Customize and manage invoice templates for your ORZEN store." },
      { property: "og:title", content: "Invoice Templates — ORZEN Store Admin" },
      { property: "og:description", content: "Customize and manage invoice templates for your ORZEN store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
