import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getOrderDetails } from "@/lib/business.functions";

export const Route = createFileRoute("/_authenticated/admin/invoice/$orderId")({
  component: InvoicePage,
});

function InvoicePage() {
  const { orderId } = Route.useParams();
  const fn = useServerFn(getOrderDetails);
  const { data } = useQuery({ queryKey: ["invoice", orderId], queryFn: () => fn({ data: { orderId } }) });

  useEffect(() => { if (data?.order) setTimeout(() => window.print(), 400); }, [data]);

  if (!data?.order) return <div className="p-6 text-sm">Loading invoice…</div>;
  const o: any = data.order;
  const subtotalItems = (data.items ?? []).reduce((a: number, it: any) => a + Number(it.price_snapshot) * Number(it.qty), 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { background: white; }
          .no-print { display: none !important; }
        }
        @media screen {
          .invoice { max-width: 320px; margin: 24px auto; box-shadow: 0 2px 10px rgba(0,0,0,.1); padding: 16px; background: white; }
        }
      `}</style>
      <div className="invoice text-[12px] text-black">
        <div className="text-center">
          {data.store?.logo_url && <img src={data.store.logo_url.startsWith("http") ? data.store.logo_url : `/api/img/${data.store.logo_url}`} alt="" className="mx-auto h-10" />}
          <div className="mt-1 text-base font-bold">{data.store?.name}</div>
          <div className="text-[10px]">{data.store?.address}</div>
          <div className="text-[10px]">{data.store?.phone}</div>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <div className="flex justify-between text-[11px]"><b>Invoice</b><span>{o.invoice_no ?? o.id.slice(0, 8).toUpperCase()}</span></div>
        <div className="flex justify-between text-[11px]"><span>Date</span><span>{new Date(o.created_at).toLocaleString()}</span></div>
        <hr className="my-2 border-dashed border-black" />
        <div className="text-[11px]"><b>{o.customer_name}</b></div>
        <div className="text-[10px]">{o.phone}</div>
        <div className="text-[10px]">{o.address}</div>
        <hr className="my-2 border-dashed border-black" />
        <table className="w-full text-[11px]">
          <thead><tr><th className="text-left">Item</th><th className="text-right">Qty</th><th className="text-right">Amt</th></tr></thead>
          <tbody>
            {(data.items ?? []).map((it: any, i: number) => (
              <tr key={i}><td className="py-0.5">{it.name_snapshot}</td><td className="text-right">{it.qty}</td><td className="text-right">{(Number(it.price_snapshot) * Number(it.qty)).toFixed(0)}</td></tr>
            ))}
          </tbody>
        </table>
        <hr className="my-2 border-dashed border-black" />
        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between"><span>Items total</span><span>৳{subtotalItems.toFixed(0)}</span></div>
          {Number(o.delivery_amount) > 0 && <div className="flex justify-between"><span>Delivery</span><span>৳{Number(o.delivery_amount).toFixed(0)}</span></div>}
          {Number(o.discount_amount) > 0 && <div className="flex justify-between"><span>Discount</span><span>-৳{Number(o.discount_amount).toFixed(0)}</span></div>}
          <div className="flex justify-between border-t pt-1 text-sm font-bold"><span>Total</span><span>৳{Number(o.subtotal).toFixed(0)}</span></div>
          <div className="text-[10px] uppercase">Payment: {o.payment_method}</div>
        </div>
        <div className="mt-3 text-center text-[10px]">Thank you for your order!</div>
        <button onClick={() => window.print()} className="no-print mt-4 w-full rounded bg-black p-2 text-white">Print invoice</button>
      </div>
    </>
  );
}
