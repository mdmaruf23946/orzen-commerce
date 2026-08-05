import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageCircle, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InvoiceRenderer } from "@/components/invoice/InvoiceRenderer";
import { getInvoicePayload } from "@/lib/invoice-templates.functions";
import { DEFAULT_BRAND, EMPTY_CANVAS } from "@/lib/invoice-template/types";

export const Route = createFileRoute("/_authenticated/admin/invoice/$orderId")({
  component: InvoicePage,
});

function InvoicePage() {
  const { orderId } = Route.useParams();
  const fn = useServerFn(getInvoicePayload);
  const { data } = useQuery({ queryKey: ["invoice-payload", orderId], queryFn: () => fn({ data: { orderId } }) });

  if (!data) return <div className="p-6 text-sm">Loading invoice…</div>;
  const invoice = data.invoice as any;
  const template: any = data.template;
  const canvas = template?.canvas ?? EMPTY_CANVAS;
  const brand = { ...DEFAULT_BRAND, ...(template?.brand ?? {}) };
  const shareUrl = invoice.order.tracking_url ?? "";
  const text = `Invoice ${invoice.order.invoice_no} — ${invoice.store.name}: ${shareUrl}`;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: #fff; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap gap-2">
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Print / Save PDF
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`sms:?&body=${encodeURIComponent(text)}`}>
            <Send className="mr-1 h-4 w-4" /> SMS
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied");
          }}
        >
          <Copy className="mr-1 h-4 w-4" /> Copy link
        </Button>
      </div>

      <FitInvoice canvas={canvas} brand={brand} data={invoice} />
    </div>
  );
}
