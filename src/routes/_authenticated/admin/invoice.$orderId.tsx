import { useEffect, useRef, useState } from "react";
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

function FitInvoice({ canvas, brand, data }: { canvas: any; brand: any; data: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const pageW = canvas?.page?.width ?? 794;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / pageW));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);

  return (
    <div ref={ref} className="w-full">
      {/* screen: auto-scaled to fit viewport width */}
      <div className="print:hidden">
        <InvoiceRenderer canvas={canvas} brand={brand} data={data} scale={scale} className="mx-auto shadow" />
      </div>
      {/* print: untouched full-size layout, isolated from admin chrome */}
      <div className="print-root hidden print:block">
        <InvoiceRenderer canvas={canvas} brand={brand} data={data} />
      </div>
    </div>
  );
}

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
