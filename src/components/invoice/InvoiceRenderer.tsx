// Shared invoice renderer. Draws an absolutely-positioned A4 canvas from
// a template + invoice data. Used by the builder preview, the store
// invoice print page and PDF export.
import { Fragment } from "react";
import {
  color,
  type Brand,
  type InvoiceCanvas,
  type InvoiceElement,
} from "@/lib/invoice-template/types";
import { applyVariables, formatMoney, type InvoiceData } from "@/lib/invoice-template/data";
import { BarcodeImage, QrImage } from "./Codes";

const COLUMN_LABELS: Record<string, string> = {
  image: "",
  name: "Item",
  sku: "SKU",
  variant: "Variant",
  qty: "Qty",
  price: "Price",
  total: "Total",
};

function imgUrl(v?: string | null) {
  if (!v) return null;
  return v.startsWith("http") || v.startsWith("/") ? v : `/api/img/${v}`;
}

function ElementBody({
  el,
  brand,
  data,
}: {
  el: InvoiceElement;
  brand: Brand;
  data: InvoiceData;
}) {
  const p = el.props ?? {};
  switch (el.type) {
    case "text":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            fontSize: p.fontSize ?? 14,
            fontWeight: p.fontWeight ?? 400,
            color: color(p.color, brand),
            textAlign: p.align ?? "left",
            lineHeight: p.lineHeight ?? 1.5,
            letterSpacing: p.letterSpacing ? `${p.letterSpacing}px` : undefined,
            whiteSpace: "pre-wrap",
            overflow: "hidden",
          }}
        >
          {applyVariables(p.content ?? "", data)}
        </div>
      );
    case "logo": {
      const src = imgUrl(data.store.logo);
      return src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: p.fit ?? "contain",
            borderRadius: p.radius ?? 0,
            opacity: p.opacity ?? 1,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            border: "1px dashed #d4d4d8",
            borderRadius: p.radius ?? 0,
            fontSize: 12,
            fontWeight: 700,
            color: color("@primary", brand),
          }}
        >
          {data.store.name?.slice(0, 12) || "LOGO"}
        </div>
      );
    }
    case "image": {
      const src = imgUrl(p.url);
      return src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: p.fit ?? "cover",
            borderRadius: p.radius ?? 0,
            opacity: p.opacity ?? 1,
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", border: "1px dashed #d4d4d8", borderRadius: p.radius ?? 0 }} />
      );
    }
    case "shape":
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: color(p.fill, brand),
            borderRadius: p.radius ?? 0,
            opacity: p.opacity ?? 1,
          }}
        />
      );
    case "divider":
      return (
        <div
          style={{
            width: "100%",
            borderTop: `${p.thickness ?? 1}px solid ${color(p.color, brand)}`,
          }}
        />
      );
    case "qr": {
      const value =
        p.source === "payment"
          ? data.order.payment_url || ""
          : p.source === "custom"
            ? applyVariables(p.value ?? "", data)
            : data.order.tracking_url || "";
      const size = Math.min(p.size ?? 100, el.w, el.h - (p.label ? 18 : 0));
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            border: p.border ? `1px solid ${color("@secondary", brand)}` : undefined,
            borderRadius: 6,
            padding: p.border ? 6 : 0,
          }}
        >
          <QrImage value={value} size={Math.max(40, size)} />
          {p.label && (
            <span style={{ fontSize: 10, color: color("@secondary", brand) }}>{p.label}</span>
          )}
        </div>
      );
    }
    case "barcode": {
      const value =
        p.source === "order" ? data.order.id : p.source === "tracking" ? data.order.tracking_id ?? "" : data.order.invoice_no;
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <BarcodeImage value={value || ""} width={el.w} height={el.h - (p.showText ? 14 : 0)} />
          {p.showText && (
            <span style={{ fontSize: 10, letterSpacing: 1, color: color("@secondary", brand) }}>{value}</span>
          )}
        </div>
      );
    }
    case "totals": {
      const cur = data.currency;
      const rows: [string, string][] = [["Subtotal", formatMoney(data.totals.subtotal, cur)]];
      if (p.showDelivery !== false) rows.push(["Delivery", formatMoney(data.totals.delivery, cur)]);
      if (p.showDiscount !== false && data.totals.discount > 0)
        rows.push(["Discount", `− ${formatMoney(data.totals.discount, cur)}`]);
      if (p.showPaid) rows.push(["Paid", formatMoney(data.totals.paid ?? 0, cur)]);
      if (p.showDue) rows.push(["Due", formatMoney(data.totals.due ?? 0, cur)]);
      return (
        <div style={{ width: "100%", fontSize: p.fontSize ?? 13, color: color(p.color, brand) }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ color: color("@secondary", brand) }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              paddingTop: 8,
              borderTop: `2px solid ${color(p.accent, brand)}`,
              fontWeight: 800,
              fontSize: (p.fontSize ?? 13) + 3,
            }}
          >
            <span>Total</span>
            <span style={{ color: color(p.accent, brand) }}>{formatMoney(data.totals.total, cur)}</span>
          </div>
        </div>
      );
    }
    case "table": {
      const cols: string[] = p.columns?.length ? p.columns : ["name", "qty", "price", "total"];
      const cur = data.currency;
      const cell = (c: string, it: (typeof data.items)[number]) => {
        switch (c) {
          case "image": {
            const src = imgUrl(it.image);
            const s = p.imageSize ?? 32;
            return src ? (
              <img src={src} alt="" style={{ width: s, height: s, objectFit: "cover", borderRadius: 4 }} />
            ) : (
              <div style={{ width: s, height: s, borderRadius: 4, background: "#f4f4f5" }} />
            );
          }
          case "name":
            return it.name;
          case "sku":
            return it.sku ?? "—";
          case "variant":
            return it.variant ?? "—";
          case "qty":
            return String(it.qty);
          case "price":
            return formatMoney(it.price, cur);
          case "total":
            return formatMoney(it.total, cur);
          default:
            return "";
        }
      };
      const numeric = (c: string) => ["qty", "price", "total"].includes(c);
      return (
        <div
          style={{
            width: "100%",
            border: `1px solid ${color(p.border, brand, "#e5e7eb")}`,
            borderRadius: p.radius ?? 0,
            overflow: "hidden",
            fontSize: p.fontSize ?? 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: cols
                .map((c) => (c === "image" ? "48px" : c === "name" ? "2fr" : "1fr"))
                .join(" "),
              background: color(p.headerColor, brand),
              color: color(p.headerTextColor, brand, "#ffffff"),
              fontWeight: 700,
            }}
          >
            {cols.map((c) => (
              <div
                key={c}
                style={{ padding: p.padding ?? 8, textAlign: numeric(c) ? "right" : "left" }}
              >
                {COLUMN_LABELS[c] ?? c}
              </div>
            ))}
          </div>
          {data.items.map((it, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: cols
                  .map((c) => (c === "image" ? "48px" : c === "name" ? "2fr" : "1fr"))
                  .join(" "),
                background: i % 2 ? color(p.altRowColor, brand, "#f9fafb") : color(p.rowColor, brand, "#ffffff"),
                borderTop: `1px solid ${color(p.border, brand, "#e5e7eb")}`,
                minHeight: p.rowHeight ?? 32,
                alignItems: "center",
                color: color("@primary", brand),
              }}
            >
              {cols.map((c) => (
                <div key={c} style={{ padding: p.padding ?? 8, textAlign: numeric(c) ? "right" : "left" }}>
                  {cell(c, it)}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

export function InvoiceRenderer({
  canvas,
  brand,
  data,
  scale = 1,
  className,
  overlay,
}: {
  canvas: InvoiceCanvas;
  brand: Brand;
  data: InvoiceData;
  scale?: number;
  className?: string;
  overlay?: (el: InvoiceElement) => React.ReactNode;
}) {
  const page = canvas?.page ?? { width: 794, height: 1123, margin: 32 };
  const els = [...(canvas?.elements ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  return (
    <div
      className={className}
      style={{
        width: page.width * scale,
        height: page.height * scale,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        data-invoice-page
        style={{
          width: page.width,
          height: page.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          background: "#ffffff",
          fontFamily: brand.font,
          color: brand.primary,
        }}
      >
        {els.map((el) =>
          el.hidden ? null : (
            <Fragment key={el.id}>
              <div
                style={{
                  position: "absolute",
                  left: el.x,
                  top: el.y,
                  width: el.w,
                  height: el.h,
                  transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
                  zIndex: el.z ?? 0,
                }}
              >
                <ElementBody el={el} brand={brand} data={data} />
                {overlay?.(el)}
              </div>
            </Fragment>
          ),
        )}
      </div>
    </div>
  );
}
