// Client-only QR + barcode helpers. Dynamically imported so SSR never
// touches the canvas-based libraries.
import { useEffect, useState } from "react";

export function QrImage({ value, size, className }: { value: string; size: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) {
      setSrc(null);
      return;
    }
    import("qrcode")
      .then((m) => m.default.toDataURL(value, { margin: 0, width: size * 2 }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (!src)
    return (
      <div
        className={className}
        style={{ width: size, height: size, border: "1px dashed #d4d4d8", borderRadius: 4 }}
      />
    );
  return <img src={src} alt="" width={size} height={size} className={className} />;
}

export function BarcodeImage({ value, width, height }: { value: string; width: number; height: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!value) {
      setSrc(null);
      return;
    }
    (async () => {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, value, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          width: 2,
          height: Math.max(30, height),
        });
        if (alive) setSrc(canvas.toDataURL("image/png"));
      } catch {
        if (alive) setSrc(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [value, height]);
  if (!src) return <div style={{ width, height, border: "1px dashed #d4d4d8" }} />;
  return <img src={src} alt="" style={{ width, height, objectFit: "fill" }} />;
}
