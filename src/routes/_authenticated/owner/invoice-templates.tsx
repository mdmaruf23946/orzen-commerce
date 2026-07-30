import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTemplatesManager } from "@/components/invoice/InvoiceTemplatesManager";

export const Route = createFileRoute("/_authenticated/owner/invoice-templates")({
  component: () => <InvoiceTemplatesManager scope="global" />,
  head: () => ({
    meta: [
      { title: "Invoice Templates — ORZEN Admin" },
      { name: "description", content: "Design global invoice templates for every ORZEN store." },
      { property: "og:title", content: "Invoice Templates — ORZEN Admin" },
      { property: "og:description", content: "Design global invoice templates for every ORZEN store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
