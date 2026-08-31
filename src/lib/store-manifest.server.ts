// Builds a real (fetchable) web app manifest for a storefront so the store can
// be installed as its own app with its own app icon.
import { storeBySlug } from "@/lib/seo.server";
import { resolveStoreAppIcon, resolveStoreFavicon } from "@/lib/store-icon";

function absolute(url: string | null, origin: string): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function storeManifestResponse(
  slug: string,
  origin: string,
  startPath: string,
): Promise<Response> {
  const store = await storeBySlug(slug);
  if (!store) return new Response("Not found", { status: 404 });

  const icon =
    absolute(resolveStoreAppIcon(store as any), origin) ??
    absolute(resolveStoreFavicon(store as any), origin);
  const name: string = (store as any).name ?? "Store";
  const themeColor: string = (store as any).primary_color || "#0f172a";

  const icons = icon
    ? [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [];

  const manifest = {
    id: startPath,
    name,
    short_name: name.slice(0, 12),
    description: (store as any).description ?? `Shop at ${name}`,
    start_url: startPath,
    scope: startPath,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
