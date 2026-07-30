import { createFileRoute } from "@tanstack/react-router";
import { DesignStudio } from "@/components/design-studio/DesignStudio";

export const Route = createFileRoute("/_authenticated/admin/invoice-design")({
  component: DesignStudio,
  head: () => ({
    meta: [
      { title: "Origin Studio — ORZEN Store Admin" },
      { name: "description", content: "Design invoices, logos, posters and banners for your store in one premium editor." },
      { property: "og:title", content: "Origin Studio — ORZEN Store Admin" },
      { property: "og:description", content: "Design invoices, logos, posters and banners for your store in one premium editor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
