import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { PLATFORM_ORIGIN } = await import("@/lib/seo");
        const { PLATFORM_FAQ } = await import("@/lib/platform-seo");
        const o = PLATFORM_ORIGIN;
        const body = `# ORZEN

> ORZEN is an all-in-one eCommerce platform for sellers in Bangladesh: online store builder, AI sales assistant for Messenger, WhatsApp and website chat, order management, courier delivery, analytics and payments.

## Main pages
- [Home](${o}/): Platform overview
- [Features](${o}/features): Everything included in ORZEN
- [Pricing](${o}/pricing): Current packages and prices (BDT)
- [About](${o}/about): About ORZEN
- [Contact](${o}/contact): Contact the ORZEN team
- [Terms](${o}/terms) and [Privacy](${o}/privacy-policy)

## FAQ
${PLATFORM_FAQ.map((f) => `- **${f.q}** ${f.a}`).join("\n")}
`;
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
