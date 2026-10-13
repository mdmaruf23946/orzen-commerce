import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrderEditHistory } from "@/lib/order-edit.functions";

const LABELS: Record<string, string> = {
  customer_name: "Name", phone: "Phone", email: "Email", address: "Address", area: "Area", notes: "Note",
};

function itemsText(items: any[] = []) {
  return items.map((i) => `${i.name} × ${i.qty} (৳${Number(i.price).toFixed(0)})`).join(", ") || "—";
}

function Change({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="text-[11px]">
      <span className="font-medium">{label}:</span>{" "}
      <span className="text-destructive line-through">{before || "—"}</span>{" → "}
      <span className="text-primary">{after || "—"}</span>
    </div>
  );
}

export function OrderEditHistory({ orderId, enabled }: { orderId: string; enabled: boolean }) {
  const fn = useServerFn(listOrderEditHistory);
  const { data = [], isLoading } = useQuery({
    queryKey: ["order-edit-history", orderId],
    queryFn: () => fn({ data: { order_id: orderId } }),
    enabled,
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  if (!data.length) return <div className="text-xs text-muted-foreground">এখনো কোনো এডিট হয়নি।</div>;

  return (
    <ul className="space-y-2">
      {data.map((r: any) => {
        const b = r.meta?.before ?? {}; const a = r.meta?.after ?? {};
        const changes: { label: string; before: string; after: string }[] = [];
        if (r.action === "order.customer_edited") {
          for (const k of Object.keys(LABELS)) {
            if ((b[k] ?? "") !== (a[k] ?? "")) changes.push({ label: LABELS[k], before: String(b[k] ?? ""), after: String(a[k] ?? "") });
          }
        } else {
          const bi = itemsText(b.items), ai = itemsText(a.items);
          if (bi !== ai) changes.push({ label: "Products", before: bi, after: ai });
          if (Number(b.delivery) !== Number(a.delivery)) changes.push({ label: "Delivery", before: `৳${b.delivery}`, after: `৳${a.delivery}` });
          if (Number(b.discount) !== Number(a.discount)) changes.push({ label: "Discount", before: `৳${b.discount}`, after: `৳${a.discount}` });
          if (a.total != null) changes.push({ label: "New total", before: "", after: `৳${Number(a.total).toFixed(0)}` });
        }
        return (
          <li key={r.id} className="space-y-1 rounded-lg border p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium">{r.summary}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">By {r.actor_name}</div>
            {changes.length ? changes.map((c, i) => <Change key={i} {...c} />) : <div className="text-[11px] text-muted-foreground">কোনো তথ্য বদলায়নি</div>}
          </li>
        );
      })}
    </ul>
  );
}
