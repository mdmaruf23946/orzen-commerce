// Store-admin manual return / exchange creation wizard.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Package, Search, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  createManualReturn,
  listReplacementProducts,
  searchOrdersForReturn,
} from "@/lib/returns-admin.functions";
import { img } from "@/components/admin/returns/ReturnDrawer";

type Kind = "return" | "exchange_same" | "exchange_other";

const KINDS: { key: Kind; label: string }[] = [
  { key: "return", label: "Return (refund)" },
  { key: "exchange_same", label: "Exchange — same product" },
  { key: "exchange_other", label: "Exchange — other product" },
];

const money = (n: number) => `৳${Number(n || 0).toFixed(0)}`;

export function ManualReturnWizard({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchOrdersForReturn);
  const catalogueFn = useServerFn(listReplacementProducts);
  const createFn = useServerFn(createManualReturn);

  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [kind, setKind] = useState<Kind>("return");
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [repl, setRepl] = useState<Record<string, number>>({});
  const [catQ, setCatQ] = useState("");
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [useGlobal, setUseGlobal] = useState(true);
  const [returnShip, setReturnShip] = useState(0);
  const [replShip, setReplShip] = useState(0);
  const [restock, setRestock] = useState(0);
  const [adjust, setAdjust] = useState(0);

  const { data: orders = [], isFetching } = useQuery({
    queryKey: ["admin", "return-order-search", term],
    queryFn: () => searchFn({ data: { q: term } }),
  });

  const { data: catalogue = [] } = useQuery({
    queryKey: ["admin", "return-catalogue", catQ],
    queryFn: () => catalogueFn({ data: { q: catQ || undefined } }),
    enabled: kind !== "return" && step >= 3,
  });

  const lines = useMemo(
    () =>
      ((order?.items as any[]) ?? [])
        .filter((i) => (qtys[i.order_item_id] ?? 0) > 0)
        .map((i) => ({ ...i, pick: qtys[i.order_item_id] as number })),
    [order, qtys],
  );

  const replacementList = useMemo(() => {
    const source = kind === "exchange_same" ? lines.map((l) => ({ id: l.product_id, name: l.name, price: l.price, image_url: l.image_url })) : (catalogue as any[]);
    return (source as any[]).filter((p) => p && p.id);
  }, [kind, lines, catalogue]);

  const itemsValue = lines.reduce((s, l) => s + l.price * l.pick, 0);
  const replValue = replacementList.reduce(
    (s: number, p: any) => s + Number(p.price ?? 0) * (repl[p.id] ?? 0),
    0,
  );
  const preview = itemsValue - replValue - (useGlobal ? 0 : returnShip + replShip + restock) - adjust;

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          order_id: order.id,
          kind,
          reason: reason || undefined,
          internal_note: internalNote || undefined,
          customer_note: customerNote || undefined,
          lines: lines.map((l) => ({ order_item_id: l.order_item_id, qty: l.pick })),
          replacements:
            kind === "return"
              ? []
              : replacementList
                  .filter((p: any) => (repl[p.id] ?? 0) > 0)
                  .map((p: any) => ({ product_id: p.id, qty: repl[p.id] as number })),
          use_global: useGlobal,
          charges: {
            return_shipping_charge: useGlobal ? 0 : returnShip,
            replacement_shipping_charge: useGlobal ? 0 : replShip,
            restocking_fee: useGlobal ? 0 : restock,
            manual_adjustment: adjust,
          },
        } as any,
      }),
    onSuccess: () => {
      toast.success("Request created");
      qc.invalidateQueries({ queryKey: ["admin", "returns"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the request"),
  });

  function bump(map: Record<string, number>, set: (v: Record<string, number>) => void, id: string, d: number, max: number) {
    const next = Math.max(0, Math.min(max, (map[id] ?? 0) + d));
    set({ ...map, [id]: next });
  }

  const canNext =
    (step === 1 && !!order) ||
    (step === 2 && lines.length > 0) ||
    (step === 3 && (kind === "return" || replacementList.some((p: any) => (repl[p.id] ?? 0) > 0)));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Create return / exchange</SheetTitle>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {step === 1 && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setTerm(q.trim());
                }}
                className="flex gap-2"
              >
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Order ID, invoice no. or phone"
                />
                <Button type="submit" variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              {isFetching && <p className="text-xs text-muted-foreground">Searching…</p>}
              <div className="space-y-2">
                {(orders as any[]).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOrder(o);
                      setQtys({});
                      setStep(2);
                    }}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted ${
                      order?.id === o.id ? "border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {o.invoice_no ?? o.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs">{money(o.total)}</span>
                    </div>
                    <div className="truncate font-medium">{o.customer_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.phone} · {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
                {!isFetching && (orders as any[]).length === 0 && (
                  <p className="text-sm text-muted-foreground">No matching orders.</p>
                )}
              </div>
            </>
          )}

          {step === 2 && order && (
            <>
              <div className="grid gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setKind(k.key)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      kind === k.key ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Items to return</Label>
                {((order.items as any[]) ?? []).map((i) => (
                  <div key={i.order_item_id} className="flex items-center gap-2 rounded-lg border p-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                      {img(i.image_url) ? (
                        <img src={img(i.image_url)!} alt={i.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {money(i.price)} · {i.returnable_qty} returnable
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => bump(qtys, setQtys, i.order_item_id, -1, i.returnable_qty)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{qtys[i.order_item_id] ?? 0}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => bump(qtys, setQtys, i.order_item_id, 1, i.returnable_qty)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {kind === "return" ? (
                <p className="text-sm text-muted-foreground">
                  Refund only — no replacement product needed.
                </p>
              ) : (
                <>
                  {kind === "exchange_other" && (
                    <Input
                      value={catQ}
                      onChange={(e) => setCatQ(e.target.value)}
                      placeholder="Search products"
                    />
                  )}
                  <div className="space-y-2">
                    {replacementList.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                          {img(p.image_url) ? (
                            <img src={img(p.image_url)!} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{money(p.price)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => bump(repl, setRepl, p.id, -1, 99)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{repl[p.id] ?? 0}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => bump(repl, setRepl, p.id, 1, 99)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong size…" />
                <Label>Internal note (staff only)</Label>
                <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} />
                <Label>Note for customer</Label>
                <Textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={2} />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Use global settings</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Off = set the charges for this request only.
                    </p>
                  </div>
                  <Switch checked={useGlobal} onCheckedChange={setUseGlobal} />
                </div>
                {!useGlobal && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px]">Return ship</Label>
                      <Input type="number" min={0} value={returnShip} onChange={(e) => setReturnShip(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Repl. ship</Label>
                      <Input type="number" min={0} value={replShip} onChange={(e) => setReplShip(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-[11px]">Restocking</Label>
                      <Input type="number" min={0} value={restock} onChange={(e) => setRestock(Number(e.target.value))} />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-[11px]">Manual adjustment (+ reduces refund)</Label>
                  <Input type="number" value={adjust} onChange={(e) => setAdjust(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Returned items</span>
                  <span>{money(itemsValue)}</span>
                </div>
                {kind !== "return" && (
                  <div className="flex justify-between">
                    <span>Replacement items</span>
                    <span>-{money(replValue)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>{preview >= 0 ? "Estimated refund" : "Customer pays"}</span>
                  <span>{money(Math.abs(preview))}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Final amounts are recalculated with store policy on save.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t p-4">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button className="flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button className="flex-1" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create request"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
