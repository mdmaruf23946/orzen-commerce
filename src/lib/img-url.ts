/** Append a resize width to our own image-proxy URLs (/api/img/...). Other URLs pass through. */
export function sizedImg(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!url.includes("/api/img/")) return url;
  if (/\.(svg|gif|ico)(\?|$)/i.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "w=" + width;
}

/** srcset with several widths for responsive images from the proxy. */
export function sizedSrcSet(url: string | null | undefined, widths: number[]): string | undefined {
  if (!url || !url.includes("/api/img/") || /\.(svg|gif|ico)(\?|$)/i.test(url)) return undefined;
  return widths.map((w) => `${sizedImg(url, w)} ${w}w`).join(", ");
}
