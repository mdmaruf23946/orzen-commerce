// Browser-only image compression helper.
// Resizes to a max long-edge and re-encodes to JPEG for large photos.
// Preserves PNGs (transparency) and small files as-is.

const DEFAULT_MAX_EDGE = 1920;
const DEFAULT_QUALITY = 0.82;
const SKIP_UNDER_BYTES = 500 * 1024; // 500 KB

export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.type === "image/png") return file; // keep transparency intact
  if (file.size < SKIP_UNDER_BYTES) return file;

  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    let blob: Blob | null = null;
    if ("convertToBlob" in canvas) {
      blob = await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality });
    } else {
      blob = await new Promise<Blob | null>((res) =>
        (canvas as HTMLCanvasElement).toBlob(res, "image/jpeg", quality),
      );
    }
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
