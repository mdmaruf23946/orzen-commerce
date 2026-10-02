import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, MessageCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Help Center — ORZEN Merchant Panel" },
      { name: "description", content: "WhatsApp বা ইমেইলের মাধ্যমে ORZEN টিমের সাথে যোগাযোগ করুন।" },
      { property: "og:title", content: "Help Center — ORZEN Merchant Panel" },
      { property: "og:description", content: "WhatsApp বা ইমেইলের মাধ্যমে ORZEN টিমের সাথে যোগাযোগ করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SupportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <LifeBuoy className="h-5 w-5" /> Help Center
        </h1>
        <p className="text-sm text-muted-foreground">যেকোনো সমস্যায় ORZEN টিমের সাথে যোগাযোগ করুন।</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a href="https://wa.me/8801624975734" target="_blank" rel="noopener noreferrer" className="rounded-2xl border bg-card p-4 hover:bg-muted/40">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-semibold">WhatsApp হেল্পলাইন</div>
          <div className="text-sm text-muted-foreground">01624975734</div>
        </a>
        <a href="mailto:support@orzen.top" className="rounded-2xl border bg-card p-4 hover:bg-muted/40">
          <Mail className="h-5 w-5 text-primary" />
          <div className="mt-2 text-sm font-semibold">ইমেইল</div>
          <div className="text-sm text-muted-foreground">support@orzen.top</div>
        </a>
      </div>
    </div>
  );
}
