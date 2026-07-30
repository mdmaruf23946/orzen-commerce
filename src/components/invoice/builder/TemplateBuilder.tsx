// Free-drag A4 invoice template builder: elements sidebar, canvas, properties panel.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Barcode,
  Copy,
  Eye,
  Image as ImageIcon,
  Lock,
  Minus,
  QrCode,
  Redo2,
  Save,
  Square,
  Table as TableIcon,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Sigma,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InvoiceRenderer } from "@/components/invoice/InvoiceRenderer";
import {
  DEFAULT_BRAND,
  newElement,
  type Brand,
  type ElementType,
  type InvoiceCanvas,
  type InvoiceElement,
} from "@/lib/invoice-template/types";
import { SAMPLE_INVOICE, VARIABLE_GROUPS, type InvoiceData } from "@/lib/invoice-template/data";

const PALETTE: { type: ElementType; label: string; icon: any }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "logo", label: "Store logo", icon: ImageIcon },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "table", label: "Product table", icon: TableIcon },
  { type: "totals", label: "Totals", icon: Sigma },
  { type: "qr", label: "QR code", icon: QrCode },
  { type: "barcode", label: "Barcode", icon: Barcode },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "shape", label: "Shape", icon: Square },
];

const SNAP = 4;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

type Props = {
  value: { name: string; description?: string | null; canvas: InvoiceCanvas; brand: Brand };
  onChange: (v: { name: string; description?: string | null; canvas: InvoiceCanvas; brand: Brand }) => void;
  onSave: () => void;
  saving?: boolean;
  data?: InvoiceData;
};

export function TemplateBuilder({ value, onChange, onSave, saving, data = SAMPLE_INVOICE }: Props) {
  const { canvas, brand } = value;
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.72);
  const [preview, setPreview] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [past, setPast] = useState<InvoiceCanvas[]>([]);
  const [future, setFuture] = useState<InvoiceCanvas[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<any>(null);

  const el = useMemo(
    () => canvas.elements.find((e) => e.id === selected) ?? null,
    [canvas.elements, selected],
  );

  const commit = useCallback(
    (next: InvoiceCanvas, snapshot = true) => {
      if (snapshot) {
        setPast((p) => [...p.slice(-40), canvas]);
        setFuture([]);
      }
      onChange({ ...value, canvas: next });
    },
    [canvas, onChange, value],
  );

  const patch = useCallback(
    (id: string, changes: Partial<InvoiceElement>, snapshot = true) => {
      commit(
        {
          ...canvas,
          elements: canvas.elements.map((e) => (e.id === id ? { ...e, ...changes } : e)),
        },
        snapshot,
      );
    },
    [canvas, commit],
  );

  const patchProps = (id: string, changes: Record<string, any>) => {
    const target = canvas.elements.find((e) => e.id === id);
    if (!target) return;
    patch(id, { props: { ...target.props, ...changes } });
  };

  function undo() {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [canvas, ...f]);
      onChange({ ...value, canvas: prev });
      return p.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, canvas]);
      onChange({ ...value, canvas: f[0] });
      return f.slice(1);
    });
  }

  function add(type: ElementType) {
    const e = newElement(type, { x: 60, y: 60 + canvas.elements.length * 8 });
    commit({ ...canvas, elements: [...canvas.elements, e] });
    setSelected(e.id);
  }

  function remove(id: string) {
    commit({ ...canvas, elements: canvas.elements.filter((e) => e.id !== id) });
    setSelected(null);
  }

  function duplicate(id: string) {
    const src = canvas.elements.find((e) => e.id === id);
    if (!src) return;
    const copy = { ...src, id: `${src.type}-${Math.random().toString(36).slice(2, 8)}`, x: src.x + 16, y: src.y + 16 };
    commit({ ...canvas, elements: [...canvas.elements, copy] });
    setSelected(copy.id);
  }

  // ---- pointer drag / resize ----
  function onPointerDown(e: React.PointerEvent, id: string, mode: "move" | "resize") {
    const target = canvas.elements.find((x) => x.id === id);
    if (!target || target.locked) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    setPast((p) => [...p.slice(-40), canvas]);
    setFuture([]);
    drag.current = { id, mode, startX: e.clientX, startY: e.clientY, orig: { ...target } };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    const o = d.orig as InvoiceElement;
    let changes: Partial<InvoiceElement>;
    if (d.mode === "move") {
      const x = snap(Math.max(0, Math.min(canvas.page.width - o.w, o.x + dx)));
      const y = snap(Math.max(0, Math.min(canvas.page.height - o.h, o.y + dy)));
      const centerX = Math.abs(x + o.w / 2 - canvas.page.width / 2) < 6;
      setGuides({ x: centerX ? canvas.page.width / 2 : undefined, y: undefined });
      changes = { x: centerX ? Math.round((canvas.page.width - o.w) / 2) : x, y };
    } else {
      changes = {
        w: snap(Math.max(24, Math.min(canvas.page.width - o.x, o.w + dx))),
        h: snap(Math.max(8, Math.min(canvas.page.height - o.y, o.h + dy))),
      };
    }
    patch(d.id, changes, false);
  }

  function onPointerUp() {
    drag.current = null;
    setGuides({});
  }

  // keyboard nudge / delete
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!selected || preview) return;
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement)?.isContentEditable) return;
      const cur = canvas.elements.find((e) => e.id === selected);
      if (!cur || cur.locked) return;
      const step = ev.shiftKey ? 10 : 1;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        remove(selected);
      } else if (ev.key === "ArrowLeft") { ev.preventDefault(); patch(selected, { x: Math.max(0, cur.x - step) }); }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); patch(selected, { x: cur.x + step }); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); patch(selected, { y: Math.max(0, cur.y - step) }); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); patch(selected, { y: cur.y + step }); }
      else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const maxZ = Math.max(0, ...canvas.elements.map((e) => e.z ?? 0));

  return (
    <div className="flex h-full flex-col gap-3 lg:flex-row">
      {/* Elements sidebar */}
      <aside className="w-full shrink-0 rounded-xl border bg-card p-3 lg:w-56">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elements</div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => add(p.type)}
              className="flex flex-col items-center gap-1 rounded-lg border bg-background p-2 text-[11px] hover:border-primary hover:bg-accent"
            >
              <p.icon className="h-4 w-4" />
              {p.label}
            </button>
          ))}
        </div>
        <Separator className="my-3" />
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layers</div>
        <ScrollArea className="max-h-52">
          <div className="space-y-1 pr-2">
            {[...canvas.elements].reverse().map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs",
                  selected === e.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span className="truncate">{e.type === "text" ? (e.props.content ?? "Text").slice(0, 18) : e.type}</span>
                {e.locked && <Lock className="h-3 w-3 shrink-0" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Canvas */}
      <section className="min-w-0 flex-1 rounded-xl border bg-muted/40 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="h-8 w-44"
            placeholder="Template name"
          />
          <Button size="sm" variant="outline" onClick={undo} disabled={!past.length}><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-4 w-4" /></Button>
          <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-4 w-4" /></Button>
          <Button size="sm" variant={preview ? "default" : "outline"} onClick={() => setPreview((p) => !p)}>
            <Eye className="mr-1 h-4 w-4" /> Preview
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="ml-auto">
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="overflow-auto rounded-lg bg-neutral-200/60 p-4 dark:bg-neutral-800/60">
          <div
            ref={stageRef}
            className="relative mx-auto bg-white shadow-lg"
            style={{ width: canvas.page.width * zoom, height: canvas.page.height * zoom }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => setSelected(null)}
          >
            <InvoiceRenderer canvas={canvas} brand={brand} data={data} scale={zoom} />
            {!preview && (
              <div className="pointer-events-none absolute inset-0">
                {guides.x !== undefined && (
                  <div className="absolute top-0 h-full w-px bg-pink-500" style={{ left: guides.x * zoom }} />
                )}
                {canvas.elements.map((e) => (
                  <div
                    key={e.id}
                    onPointerDown={(ev) => onPointerDown(ev, e.id, "move")}
                    onClick={(ev) => { ev.stopPropagation(); setSelected(e.id); }}
                    className={cn(
                      "pointer-events-auto absolute",
                      e.locked ? "cursor-not-allowed" : "cursor-move",
                      selected === e.id ? "outline outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-primary/40",
                    )}
                    style={{
                      left: e.x * zoom,
                      top: e.y * zoom,
                      width: e.w * zoom,
                      height: Math.max(e.h, 6) * zoom,
                    }}
                  >
                    {selected === e.id && !e.locked && (
                      <span
                        onPointerDown={(ev) => onPointerDown(ev, e.id, "resize")}
                        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white bg-primary"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Properties */}
      <aside className="w-full shrink-0 rounded-xl border bg-card p-3 lg:w-72">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</div>
        <ScrollArea className="h-[520px] pr-2">
          {!el ? (
            <BrandPanel brand={brand} onChange={(b) => onChange({ ...value, brand: b })} />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => patch(el.id, { locked: !el.locked })}>
                  {el.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(el.id)}><Copy className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => patch(el.id, { z: maxZ + 1 })}><ArrowUpToLine className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => patch(el.id, { z: -1 })}><ArrowDownToLine className="h-4 w-4" /></Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch(el.id, { x: Math.round((canvas.page.width - el.w) / 2) })}
                >
                  <AlignCenterVertical className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch(el.id, { y: Math.round((canvas.page.height - el.h) / 2) })}
                >
                  <AlignCenterHorizontal className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(el.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <div key={k}>
                    <Label className="text-[11px] uppercase">{k}</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={Math.round((el as any)[k])}
                      onChange={(ev) => patch(el.id, { [k]: Number(ev.target.value) } as any)}
                    />
                  </div>
                ))}
              </div>

              <ElementProps el={el} onProps={(c) => patchProps(el.id, c)} />
            </div>
          )}
        </ScrollArea>
      </aside>
    </div>
  );
}

function BrandPanel({ brand, onChange }: { brand: Brand; onChange: (b: Brand) => void }) {
  const b = { ...DEFAULT_BRAND, ...brand };
  const set = (k: keyof Brand, v: any) => onChange({ ...b, [k]: v });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Select an element to edit it, or set brand defaults below.</p>
      {(["primary", "secondary", "accent"] as const).map((k) => (
        <div key={k}>
          <Label className="text-[11px] capitalize">{k} colour</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={b[k]}
              onChange={(e) => set(k, e.target.value)}
              className="h-8 w-10 rounded border bg-background"
            />
            <Input className="h-8" value={b[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        </div>
      ))}
      <div>
        <Label className="text-[11px]">Font family</Label>
        <Select value={b.font} onValueChange={(v) => set("font", v)}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter, system-ui, sans-serif">Inter / Sans</SelectItem>
            <SelectItem value="Georgia, 'Times New Roman', serif">Georgia / Serif</SelectItem>
            <SelectItem value="'Courier New', monospace">Monospace</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function VariablePicker({ onPick }: { onPick: (token: string) => void }) {
  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Insert variable</div>
      <div className="max-h-40 space-y-2 overflow-auto">
        {VARIABLE_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="text-[10px] uppercase text-muted-foreground">{g.group}</div>
            <div className="flex flex-wrap gap-1">
              {g.vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onPick(`{{${v.key}}}`)}
                  className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementProps({ el, onProps }: { el: InvoiceElement; onProps: (c: Record<string, any>) => void }) {
  const p = el.props ?? {};
  const colorField = (key: string, label: string) => (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={(p[key] ?? "#000000").startsWith("#") ? p[key] : "#000000"}
          onChange={(e) => onProps({ [key]: e.target.value })}
          className="h-8 w-10 rounded border bg-background"
        />
        <Input className="h-8" value={p[key] ?? ""} onChange={(e) => onProps({ [key]: e.target.value })} placeholder="@primary" />
      </div>
    </div>
  );

  switch (el.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label className="text-[11px]">Content</Label>
          <Textarea
            rows={4}
            value={p.content ?? ""}
            onChange={(e) => onProps({ content: e.target.value })}
          />
          <VariablePicker onPick={(t) => onProps({ content: `${p.content ?? ""}${t}` })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Font size</Label>
              <Input type="number" className="h-8" value={p.fontSize ?? 14} onChange={(e) => onProps({ fontSize: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[11px]">Weight</Label>
              <Select value={String(p.fontWeight ?? 400)} onValueChange={(v) => onProps({ fontWeight: Number(v) })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[300, 400, 500, 600, 700, 800].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Align</Label>
              <Select value={p.align ?? "left"} onValueChange={(v) => onProps({ align: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["left", "center", "right"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Line height</Label>
              <Input type="number" step="0.1" className="h-8" value={p.lineHeight ?? 1.5} onChange={(e) => onProps({ lineHeight: Number(e.target.value) })} />
            </div>
          </div>
          {colorField("color", "Text colour")}
        </div>
      );
    case "table":
      return (
        <div className="space-y-2">
          <Label className="text-[11px]">Columns</Label>
          <div className="flex flex-wrap gap-1">
            {["image", "name", "sku", "variant", "qty", "price", "total"].map((c) => {
              const on = (p.columns ?? []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    onProps({
                      columns: on
                        ? (p.columns ?? []).filter((x: string) => x !== c)
                        : [...(p.columns ?? []), c],
                    })
                  }
                  className={cn("rounded border px-2 py-0.5 text-[11px]", on ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {colorField("headerColor", "Header background")}
          {colorField("headerTextColor", "Header text")}
          {colorField("altRowColor", "Alt row")}
          {colorField("border", "Border")}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Row height</Label>
              <Input type="number" className="h-8" value={p.rowHeight ?? 36} onChange={(e) => onProps({ rowHeight: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[11px]">Font size</Label>
              <Input type="number" className="h-8" value={p.fontSize ?? 12} onChange={(e) => onProps({ fontSize: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Show product image</Label>
            <Switch checked={!!p.showImage} onCheckedChange={(v) => onProps({ showImage: v })} />
          </div>
        </div>
      );
    case "totals":
      return (
        <div className="space-y-2">
          {colorField("accent", "Accent")}
          {[["showDelivery", "Show delivery"], ["showDiscount", "Show discount"], ["showPaid", "Show paid"], ["showDue", "Show due"]].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between">
              <Label className="text-[11px]">{label}</Label>
              <Switch checked={p[k] !== false && !!p[k]} onCheckedChange={(v) => onProps({ [k]: v })} />
            </div>
          ))}
          <div>
            <Label className="text-[11px]">Font size</Label>
            <Input type="number" className="h-8" value={p.fontSize ?? 13} onChange={(e) => onProps({ fontSize: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "qr":
      return (
        <div className="space-y-2">
          <Label className="text-[11px]">Source</Label>
          <Select value={p.source ?? "tracking"} onValueChange={(v) => onProps({ source: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tracking">Order tracking link</SelectItem>
              <SelectItem value="payment">Payment link</SelectItem>
              <SelectItem value="custom">Custom text</SelectItem>
            </SelectContent>
          </Select>
          {p.source === "custom" && (
            <Input className="h-8" value={p.value ?? ""} onChange={(e) => onProps({ value: e.target.value })} placeholder="{{order_id}}" />
          )}
          <div>
            <Label className="text-[11px]">Label</Label>
            <Input className="h-8" value={p.label ?? ""} onChange={(e) => onProps({ label: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Border</Label>
            <Switch checked={!!p.border} onCheckedChange={(v) => onProps({ border: v })} />
          </div>
        </div>
      );
    case "barcode":
      return (
        <div className="space-y-2">
          <Label className="text-[11px]">Source</Label>
          <Select value={p.source ?? "invoice"} onValueChange={(v) => onProps({ source: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">Invoice number</SelectItem>
              <SelectItem value="order">Order ID</SelectItem>
              <SelectItem value="tracking">Tracking ID</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Show text</Label>
            <Switch checked={p.showText !== false} onCheckedChange={(v) => onProps({ showText: v })} />
          </div>
        </div>
      );
    case "shape":
      return (
        <div className="space-y-2">
          {colorField("fill", "Fill")}
          <div>
            <Label className="text-[11px]">Corner radius</Label>
            <Input type="number" className="h-8" value={p.radius ?? 0} onChange={(e) => onProps({ radius: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="space-y-2">
          {colorField("color", "Colour")}
          <div>
            <Label className="text-[11px]">Thickness</Label>
            <Input type="number" className="h-8" value={p.thickness ?? 1} onChange={(e) => onProps({ thickness: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <Label className="text-[11px]">Image URL or storage path</Label>
          <Input className="h-8" value={p.url ?? ""} onChange={(e) => onProps({ url: e.target.value })} />
          <div>
            <Label className="text-[11px]">Corner radius</Label>
            <Input type="number" className="h-8" value={p.radius ?? 0} onChange={(e) => onProps({ radius: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "logo":
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Uses the store logo automatically.</p>
          <Label className="text-[11px]">Fit</Label>
          <Select value={p.fit ?? "contain"} onValueChange={(v) => onProps({ fit: v })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Contain</SelectItem>
              <SelectItem value="cover">Cover</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return null;
  }
}
