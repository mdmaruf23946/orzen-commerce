import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTemplatesManager } from "@/components/invoice/InvoiceTemplatesManager";

export const Route = createFileRoute("/_authenticated/admin/invoice-design")({
  component: () => <InvoiceTemplatesManager scope="store" />,
  head: () => ({
    meta: [
      { title: "Invoice Design — Store Admin" },
      { name: "description", content: "Customise your store's invoice layout, branding and printed details." },
      { property: "og:title", content: "Invoice Design — Store Admin" },
      { property: "og:description", content: "Customise your store's invoice layout, branding and printed details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
