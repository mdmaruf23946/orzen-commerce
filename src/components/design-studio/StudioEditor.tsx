// ORZEN Design Studio editor shell. Same editing engine as the original
// TemplateBuilder (state model, undo stack, pointer math) wrapped in a
// professional three-panel layout.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpToLine,
  Barcode,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  Image as ImageIcon,
  Layers as LayersIcon,
  Lock,
  Maximize,
  Minus,
  Palette,
  PanelLeft,
  PanelRight,
  QrCode,
  Redo2,
  Ruler,
  Save,
  Search,
  Shapes,
  Sigma,
  Sparkles,
  Square,
  Table as TableIcon,
  Trash2,
  Type,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { InvoiceRenderer } from "@/components/invoice/InvoiceRenderer";
import { BrandPanel, ElementProps } from "@/components/invoice/builder/TemplateBuilder";
import {
  newElement,
  type Brand,
  type ElementType,
  type InvoiceCanvas,
  type InvoiceElement,
} from "@/lib/invoice-template/types";
import { SAMPLE_INVOICE, type InvoiceData } from "@/lib/invoice-template/data";
import {
  FUTURE_ELEMENT_GROUPS,
  KIND_MAP,
  ZOOM_PRESETS,
  canvasKind,
  canvasPresetId,
} from "@/lib/design-studio/registry";

const SNAP = 4;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

type Draft = { name: string; description?: string | null; canvas: InvoiceCanvas; brand: Brand };

type Props = {
  value: Draft;
  onChange: (v: Draft) => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onBack: () => void;
  saving?: boolean;
  data?: InvoiceData;
};

const BASIC: { type: ElementType; label: string; icon: any }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "logo", label: "Logo", icon: Sparkles },
  { type: "shape", label: "Shape", icon: Square },
  { type: "icon", label: "Icons", icon: Shapes },
  { type: "qr", label: "QR", icon: QrCode },
  { type: "barcode", label: "Barcode", icon: Barcode },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "table", label: "Table", icon: TableIcon },
];

const INVOICE_BLOCKS: { label: string; icon: any; build: () => InvoiceElement }[] = [
  { label: "Product Table", icon: TableIcon, build: () => newElement("table", { x: 48, y: 420 }) },
  {
    label: "Customer Info",
    icon: Type,
    build: () => {
      const e = newElement("text", { x: 48, y: 260 });
      e.props.content = "Bill to\n{{customer_name}}\n{{customer_phone}}\n{{customer_address}}";
      e.h = 90;
      return e;
    },
  },
  {
    label: "Store Info",
    icon: Type,
    build: () => {
      const e = newElement("text", { x: 48, y: 60 });
      e.props.content = "{{store_name}}\n{{store_address}}\n{{store_phone}}";
      e.h = 72;
      return e;
    },
  },
  { label: "Payment QR", icon: QrCode, build: () => { const e = newElement("qr", { x: 620, y: 60 }); e.props.source = "payment"; e.props.label = "Pay"; return e; } },
  {
    label: "Courier Block",
    icon: Type,
    build: () => {
      const e = newElement("text", { x: 430, y: 260 });
      e.props.content = "Courier: {{courier_name}}\nTracking: {{tracking_id}}";
      e.h = 48;
      return e;
    },
  },
  {
    label: "Invoice Info",
    icon: Type,
    build: () => {
      const e = newElement("text", { x: 430, y: 160 });
      e.props.content = "Invoice #{{invoice_no}}\nDate: {{order_date}}\nStatus: {{order_status}}";
      e.h = 60;
      return e;
    },
  },
  { label: "Totals", icon: Sigma, build: () => newElement("totals", { x: 440, y: 760 }) },
  {
    label: "Terms",
    icon: Type,
    build: () => {
      const e = newElement("text", { x: 48, y: 960 });
      e.props.content = "Terms & conditions: goods once sold are not returnable without prior approval.";
      e.props.fontSize = 10;
      e.h = 40;
      return e;
    },
  },
];

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function StudioEditor({ value, onChange, onSave, onSaveAs, onBack, saving, data = SAMPLE_INVOICE }: Props) {
  const { canvas, brand } = value;
  const kind = canvasKind(canvas);
  const kindDef = KIND_MAP[kind];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.72);
  const [preview, setPreview] = useState(false);
  const [grid, setGrid] = useState(false);
  const [rulers, setRulers] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [past, setPast] = useState<InvoiceCanvas[]>([]);
  const [future, setFuture] = useState<InvoiceCanvas[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("design");
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const clipboard = useRef<InvoiceElement[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<any>(null);

  const selected = selectedIds[0] ?? null;
  const el = useMemo(
    () => canvas.elements.find((e) => e.id === selected) ?? null,
    [canvas.elements, selected],
  );

  const visibleCanvas = useMemo<InvoiceCanvas>(
    () => ({ ...canvas, elements: canvas.elements.filter((e) => !e.hidden) }),
    [canvas],
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
        { ...canvas, elements: canvas.elements.map((e) => (e.id === id ? { ...e, ...changes } : e)) },
        snapshot,
      );
    },
    [canvas, commit],
  );

  const patchMany = useCallback(
    (map: Record<string, Partial<InvoiceElement>>, snapshot = true) => {
      commit(
        { ...canvas, elements: canvas.elements.map((e) => (map[e.id] ? { ...e, ...map[e.id] } : e)) },
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

  function addElement(e: InvoiceElement) {
    commit({ ...canvas, elements: [...canvas.elements, e] });
    setSelectedIds([e.id]);
  }
  function add(type: ElementType) {
    addElement(newElement(type, { x: 60, y: 60 + canvas.elements.length * 8 }));
  }
  function addBackground() {
    const e = newElement("shape", { x: 0, y: 0 });
    e.w = canvas.page.width;
    e.h = canvas.page.height;
    e.z = -1;
    e.props = { fill: "@accent", radius: 0 };
    addElement(e);
  }

  function removeIds(ids: string[]) {
    commit({ ...canvas, elements: canvas.elements.filter((e) => !ids.includes(e.id) || e.locked) });
    setSelectedIds([]);
  }

  function duplicateIds(ids: string[]) {
    const copies = canvas.elements
      .filter((e) => ids.includes(e.id))
      .map((src) => ({
        ...src,
        id: `${src.type}-${Math.random().toString(36).slice(2, 8)}`,
        x: src.x + 16,
        y: src.y + 16,
      }));
    if (!copies.length) return;
    commit({ ...canvas, elements: [...canvas.elements, ...copies] });
    setSelectedIds(copies.map((c) => c.id));
  }

  // ---- pointer drag / resize ----
  function onPointerDown(ev: React.PointerEvent, id: string, mode: "move" | "resize") {
    const target = canvas.elements.find((x) => x.id === id);
    if (!target || target.locked) return;
    ev.stopPropagation();
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    const ids = ev.shiftKey
      ? selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
      : selectedIds.includes(id)
        ? selectedIds
        : [id];
    setSelectedIds(ids.length ? ids : [id]);
    setPast((p) => [...p.slice(-40), canvas]);
    setFuture([]);
    drag.current = {
      ids: mode === "move" ? (ids.length ? ids : [id]) : [id],
      mode,
      startX: ev.clientX,
      startY: ev.clientY,
      orig: Object.fromEntries(canvas.elements.filter((e) => ids.includes(e.id) || e.id === id).map((e) => [e.id, { ...e }])),
    };
  }

  function onPointerMove(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (ev.clientX - d.startX) / zoom;
    const dy = (ev.clientY - d.startY) / zoom;
    const map: Record<string, Partial<InvoiceElement>> = {};
    if (d.mode === "move") {
      let guideX: number | undefined;
      for (const id of d.ids as string[]) {
        const o = d.orig[id] as InvoiceElement;
        if (!o || o.locked) continue;
        const x = snap(Math.max(0, Math.min(canvas.page.width - o.w, o.x + dx)));
        const y = snap(Math.max(0, Math.min(canvas.page.height - o.h, o.y + dy)));
        const centered = d.ids.length === 1 && Math.abs(x + o.w / 2 - canvas.page.width / 2) < 6;
        if (centered) guideX = canvas.page.width / 2;
        map[id] = { x: centered ? Math.round((canvas.page.width - o.w) / 2) : x, y };
      }
      setGuides({ x: guideX });
    } else {
      const id = d.ids[0];
      const o = d.orig[id] as InvoiceElement;
      if (o) {
        map[id] = {
          w: snap(Math.max(24, Math.min(canvas.page.width - o.x, o.w + dx))),
          h: snap(Math.max(8, Math.min(canvas.page.height - o.y, o.h + dy))),
        };
      }
    }
    patchMany(map, false);
  }

  function onPointerUp() {
    drag.current = null;
    setGuides({});
  }

  // ---- keyboard ----
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (preview) return;
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement)?.isContentEditable) return;
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        ev.shiftKey ? redo() : undo();
        return;
      }
      if (!selectedIds.length) return;
      const live = canvas.elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
      if (mod && ev.key.toLowerCase() === "c") { clipboard.current = live.map((e) => ({ ...e })); return; }
      if (mod && ev.key.toLowerCase() === "v") {
        ev.preventDefault();
        const copies = clipboard.current.map((src) => ({
          ...src,
          id: `${src.type}-${Math.random().toString(36).slice(2, 8)}`,
          x: src.x + 20,
          y: src.y + 20,
        }));
        if (copies.length) { commit({ ...canvas, elements: [...canvas.elements, ...copies] }); setSelectedIds(copies.map((c) => c.id)); }
        return;
      }
      if (mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); duplicateIds(selectedIds); return; }
      if (!live.length) return;
      const step = ev.shiftKey ? 10 : 1;
      const nudge = (fx: (e: InvoiceElement) => Partial<InvoiceElement>) => {
        ev.preventDefault();
        patchMany(Object.fromEntries(live.map((e) => [e.id, fx(e)])));
      };
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); removeIds(selectedIds); }
      else if (ev.key === "ArrowLeft") nudge((e) => ({ x: Math.max(0, e.x - step) }));
      else if (ev.key === "ArrowRight") nudge((e) => ({ x: e.x + step }));
      else if (ev.key === "ArrowUp") nudge((e) => ({ y: Math.max(0, e.y - step) }));
      else if (ev.key === "ArrowDown") nudge((e) => ({ y: e.y + step }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const maxZ = Math.max(0, ...canvas.elements.map((e) => e.z ?? 0));
  const minZ = Math.min(0, ...canvas.elements.map((e) => e.z ?? 0));

  function fitScreen() {
    const box = viewportRef.current;
    if (!box) return;
    const z = Math.min(
      (box.clientWidth - 64) / canvas.page.width,
      (box.clientHeight - 64) / canvas.page.height,
    );
    setZoom(Math.max(0.1, +z.toFixed(2)));
  }
  function fitWidth() {
    const box = viewportRef.current;
    if (!box) return;
    setZoom(Math.max(0.1, +((box.clientWidth - 64) / canvas.page.width).toFixed(2)));
  }

  function setPreset(id: string) {
    const p = kindDef.presets.find((x) => x.id === id);
    if (!p) return;
    commit({
      ...canvas,
      page: { ...canvas.page, width: p.width, height: p.height, preset: p.id } as any,
    });
  }
  function setOrientation(o: "portrait" | "landscape") {
    const isLandscape = canvas.page.width > canvas.page.height;
    if ((o === "landscape") === isLandscape) return;
    commit({ ...canvas, page: { ...canvas.page, width: canvas.page.height, height: canvas.page.width } as any });
  }

  const filteredBasic = BASIC.filter((b) => b.label.toLowerCase().includes(query.toLowerCase()));
  const filteredBlocks = INVOICE_BLOCKS.filter((b) => b.label.toLowerCase().includes(query.toLowerCase()));

  /* ---------------- panels ---------------- */

  const elementsPanel = (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search elements" className="h-9 pl-8" />
      </div>

      <Section title="Basic" icon={Shapes}>
        <div className="grid grid-cols-3 gap-2">
          {filteredBasic.map((b) => (
            <button
              key={b.type + b.label}
              type="button"
              onClick={() => add(b.type)}
              className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-2.5 text-[11px] transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"
            >
              <b.icon className="h-4 w-4 text-muted-foreground" />
              {b.label}
            </button>
          ))}
        </div>
      </Section>

      {kind === "invoice" && (
        <Section title="Invoice blocks" icon={TableIcon}>
          <div className="grid grid-cols-2 gap-2">
            {filteredBlocks.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => addElement(b.build())}
                className="flex items-center gap-2 rounded-xl border bg-background p-2 text-left text-[11px] transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <b.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{b.label}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Design" icon={Palette}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={addBackground} className="rounded-xl border bg-background p-2 text-[11px] hover:border-primary/50">
            Background
          </button>
          <button
            type="button"
            onClick={() => { setSelectedIds([]); setTab("design"); }}
            className="rounded-xl border bg-background p-2 text-[11px] hover:border-primary/50"
          >
            Brand Colors
          </button>
          <button
            type="button"
            onClick={() => { setSelectedIds([]); setTab("design"); }}
            className="rounded-xl border bg-background p-2 text-[11px] hover:border-primary/50"
          >
            Typography
          </button>
          <button
            type="button"
            onClick={() => toast.info("Gradient fills are coming in a future update")}
            className="rounded-xl border border-dashed bg-muted/40 p-2 text-[11px] text-muted-foreground"
          >
            Gradient
          </button>
        </div>
      </Section>

      {FUTURE_ELEMENT_GROUPS.map((g) => (
        <Section key={g.label} title={g.label} icon={g.icon} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((i) => (
              <div key={i} className="rounded-xl border border-dashed bg-muted/40 p-2 text-[11px] text-muted-foreground">
                {i}
              </div>
            ))}
          </div>
          <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
        </Section>
      ))}
    </div>
  );

  const inspector = (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
      <div className="border-b p-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="design" className="text-xs">Design</TabsTrigger>
          <TabsTrigger value="layers" className="text-xs">Layers</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="design" className="m-0 min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-2 p-3">
            {!el ? (
              <Section title="Brand kit" icon={Palette}>
                <BrandPanel brand={brand} onChange={(b) => onChange({ ...value, brand: b })} />
              </Section>
            ) : (
              <>
                <Section title="Quick actions">
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" title="Lock" onClick={() => patch(el.id, { locked: !el.locked })}>
                      {el.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" title="Visibility" onClick={() => patch(el.id, { hidden: !el.hidden })}>
                      {el.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" title="Duplicate" onClick={() => duplicateIds([el.id])}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" title="Delete" onClick={() => removeIds([el.id])} disabled={el.locked}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Section>

                <Section title="Position & size">
                  <div className="grid grid-cols-2 gap-2">
                    {(["x", "y", "w", "h"] as const).map((k) => (
                      <div key={k}>
                        <Label className="text-[11px] uppercase">{k === "w" ? "width" : k === "h" ? "height" : k}</Label>
                        <Input
                          type="number"
                          className="h-8"
                          disabled={el.locked}
                          value={Math.round((el as any)[k])}
                          onChange={(ev) => patch(el.id, { [k]: Number(ev.target.value) } as any)}
                        />
                      </div>
                    ))}
                    <div>
                      <Label className="text-[11px] uppercase">Rotation</Label>
                      <Input
                        type="number"
                        className="h-8"
                        disabled={el.locked}
                        value={Math.round(el.rot ?? 0)}
                        onChange={(ev) => patch(el.id, { rot: Number(ev.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase">Opacity</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        className="h-8"
                        disabled={el.locked}
                        value={el.props?.opacity ?? 1}
                        onChange={(ev) => patchProps(el.id, { opacity: Number(ev.target.value) })}
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Alignment & layers">
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" title="Center horizontally" disabled={el.locked} onClick={() => patch(el.id, { x: Math.round((canvas.page.width - el.w) / 2) })}>
                      <AlignCenterVertical className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Center vertically" disabled={el.locked} onClick={() => patch(el.id, { y: Math.round((canvas.page.height - el.h) / 2) })}>
                      <AlignCenterHorizontal className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Bring to front" onClick={() => patch(el.id, { z: maxZ + 1 })}>
                      <ArrowUpToLine className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Forward" onClick={() => patch(el.id, { z: (el.z ?? 0) + 1 })}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Backward" onClick={() => patch(el.id, { z: (el.z ?? 0) - 1 })}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Send to back" onClick={() => patch(el.id, { z: minZ - 1 })}>
                      <ArrowDownToLine className="h-4 w-4" />
                    </Button>
                  </div>
                </Section>

                {el.locked ? (
                  <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                    <Lock className="mx-auto mb-1 h-4 w-4" />
                    This layer is locked. Unlock it to edit.
                  </div>
                ) : (
                  <Section title="Properties">
                    <ElementProps el={el} onProps={(c) => patchProps(el.id, c)} />
                  </Section>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="layers" className="m-0 min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-1 p-3">
            {[...canvas.elements]
              .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))
              .map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs",
                    selectedIds.includes(e.id) ? "border-primary bg-primary/10" : "bg-background hover:bg-muted",
                  )}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setSelectedIds([e.id])}>
                    {e.props?.label || (e.type === "text" ? String(e.props?.content ?? "Text").slice(0, 22) : e.type)}
                  </button>
                  <button type="button" title="Hide" onClick={() => patch(e.id, { hidden: !e.hidden })} className="p-1 text-muted-foreground hover:text-foreground">
                    {e.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" title="Lock" onClick={() => patch(e.id, { locked: !e.locked })} className="p-1 text-muted-foreground hover:text-foreground">
                    {e.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" title="Forward" onClick={() => patch(e.id, { z: (e.z ?? 0) + 1 })} className="p-1 text-muted-foreground hover:text-foreground">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Backward" onClick={() => patch(e.id, { z: (e.z ?? 0) - 1 })} className="p-1 text-muted-foreground hover:text-foreground">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            {!canvas.elements.length && (
              <p className="p-4 text-center text-xs text-muted-foreground">No layers yet. Add an element to begin.</p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );

  const stageW = canvas.page.width * zoom;
  const stageH = canvas.page.height * zoom;

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Top toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-background/80 px-2 py-2 backdrop-blur">
        <Button size="icon" variant="ghost" onClick={onBack} title="Back" className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <kindDef.icon className="hidden h-4 w-4 text-primary sm:block" />
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="h-8 w-32 border-transparent bg-transparent px-2 font-medium hover:border-input focus-visible:border-input sm:w-48"
          placeholder="Untitled design"
        />
        <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">{kindDef.short}</Badge>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} disabled={!past.length} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} disabled={!future.length} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={preview ? "default" : "ghost"} className="h-8" onClick={() => setPreview((p) => !p)}>
            <Eye className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button size="sm" variant="ghost" className="hidden h-8 md:inline-flex" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          {onSaveAs && (
            <Button size="sm" variant="outline" className="hidden h-8 md:inline-flex" onClick={onSaveAs}>
              Save As
            </Button>
          )}
          <Button size="sm" className="h-8" onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Elements panel */}
        {showLeft && (
          <aside className="hidden w-64 shrink-0 border-r bg-muted/20 lg:block">
            <ScrollArea className="h-full">{elementsPanel}</ScrollArea>
          </aside>
        )}

        {/* Canvas */}
        <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--color-foreground)_12%,transparent)_1px,transparent_0)] [background-size:22px_22px]">
          <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto p-6">
            {rulers && (
              <>
                <div className="pointer-events-none sticky top-0 z-10 -mt-6 mb-1 h-5 w-full bg-background/80 text-[9px] text-muted-foreground backdrop-blur">
                  <div className="flex h-full items-end">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div key={i} className="h-2 shrink-0 border-l border-border" style={{ width: 50 * zoom }} />
                    ))}
                  </div>
                </div>
              </>
            )}
            <div
              className="relative mx-auto rounded-sm bg-white shadow-[0_20px_60px_-25px_rgba(0,0,0,0.45)]"
              style={{ width: stageW, height: stageH }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onClick={() => setSelectedIds([])}
            >
              <InvoiceRenderer canvas={visibleCanvas} brand={brand} data={data} scale={zoom} />

              {!preview && (
                <div className="pointer-events-none absolute inset-0">
                  {grid && (
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(99,102,241,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,.18) 1px, transparent 1px)",
                        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                      }}
                    />
                  )}
                  <div
                    className="absolute border border-dashed border-primary/30"
                    style={{
                      left: (canvas.page.margin ?? 24) * zoom,
                      top: (canvas.page.margin ?? 24) * zoom,
                      right: (canvas.page.margin ?? 24) * zoom,
                      bottom: (canvas.page.margin ?? 24) * zoom,
                    }}
                  />
                  {guides.x !== undefined && (
                    <div className="absolute top-0 h-full w-px bg-pink-500" style={{ left: guides.x * zoom }} />
                  )}
                  {canvas.elements.map((e) => (
                    <div
                      key={e.id}
                      onPointerDown={(ev) => onPointerDown(ev, e.id, "move")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedIds((s) =>
                          ev.shiftKey ? (s.includes(e.id) ? s.filter((i) => i !== e.id) : [...s, e.id]) : [e.id],
                        );
                      }}
                      className={cn(
                        "pointer-events-auto absolute",
                        e.locked ? "cursor-not-allowed" : "cursor-move",
                        selectedIds.includes(e.id)
                          ? "outline outline-2 outline-primary"
                          : "hover:outline hover:outline-1 hover:outline-primary/40",
                        e.hidden && "opacity-40",
                      )}
                      style={{
                        left: e.x * zoom,
                        top: e.y * zoom,
                        width: e.w * zoom,
                        height: Math.max(e.h, 6) * zoom,
                        transform: e.rot ? `rotate(${e.rot}deg)` : undefined,
                      }}
                    >
                      {selectedIds.includes(e.id) && e.locked && (
                        <span className="absolute -top-2 -right-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Lock className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {selectedIds.length === 1 && selectedIds[0] === e.id && !e.locked && (
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

          {/* Bottom bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t bg-background/80 px-2 py-1.5 text-xs backdrop-blur">
            <Button size="icon" variant="ghost" className="h-7 w-7 lg:hidden" onClick={() => setShowLeft((v) => !v)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 lg:hidden">
                  <Shapes className="mr-1 h-4 w-4" /> Elements
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-0 sm:w-80">
                {elementsPanel}
              </SheetContent>
            </Sheet>

            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Select value={String(zoom)} onValueChange={(v) => setZoom(Number(v))}>
              <SelectTrigger className="h-7 w-[86px] text-xs"><SelectValue>{Math.round(zoom * 100)}%</SelectValue></SelectTrigger>
              <SelectContent>
                {ZOOM_PRESETS.map((z) => (
                  <SelectItem key={z} value={String(z)}>{Math.round(z * 100)}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={fitScreen}><Maximize className="mr-1 h-3.5 w-3.5" /> Fit</Button>
            <Button size="sm" variant="ghost" className="hidden h-7 sm:inline-flex" onClick={fitWidth}>Fit width</Button>

            <Separator orientation="vertical" className="mx-1 h-5" />
            <Select value={canvasPresetId(canvas) ?? "custom"} onValueChange={setPreset}>
              <SelectTrigger className="h-7 w-[132px] text-xs"><SelectValue placeholder="Canvas size" /></SelectTrigger>
              <SelectContent>
                {kindDef.presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
                <SelectItem value="custom" disabled>Custom</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="hidden h-7 sm:inline-flex" onClick={() => setOrientation(canvas.page.width > canvas.page.height ? "portrait" : "landscape")}>
              {canvas.page.width > canvas.page.height ? "Landscape" : "Portrait"}
            </Button>
            <Button size="icon" variant={grid ? "secondary" : "ghost"} className="h-7 w-7" title="Grid" onClick={() => setGrid((v) => !v)}>
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={rulers ? "secondary" : "ghost"} className="h-7 w-7" title="Rulers" onClick={() => setRulers((v) => !v)}>
              <Ruler className="h-4 w-4" />
            </Button>

            <div className="ml-auto flex items-center gap-1.5">
              <span className="hidden text-muted-foreground sm:inline">
                {Math.round(canvas.page.width)} × {Math.round(canvas.page.height)} px
              </span>
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 xl:hidden">
                    <LayersIcon className="mr-1 h-4 w-4" /> Properties
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] max-w-sm p-0 sm:w-80">
                  <div className="h-full pt-6">{inspector}</div>
                </SheetContent>
              </Sheet>
              <Button size="icon" variant="ghost" className="hidden h-7 w-7 xl:inline-flex" onClick={() => setShowRight((v) => !v)}>
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Inspector */}
        {showRight && (
          <aside className="hidden w-72 shrink-0 border-l bg-muted/20 xl:block">{inspector}</aside>
        )}
      </div>
    </div>
  );
}
