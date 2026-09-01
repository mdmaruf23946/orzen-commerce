// Builds a real (fetchable) web app manifest for a builder landing page so the
// page can be installed as its own app, with its own page icon and name —
// completely separate from the ORZEN platform app.
import { publicSb } from "@/lib/seo.server";
import { lpImage } from "@/lib/landing-builder";

function absolute(url: string | null | undefined, origin: string): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function landingManifestResponse(
  slug: string,
  origin: string,
  startPath: string,
): Promise<Response> {
  const supabase = publicSb();
  const { data } = await supabase.rpc("get_public_landing_page", { _slug: slug.toLowerCase() });
  const page = data as any;
  if (!page) return new Response("Not found", { status: 404 });

  const seo = (page.seo ?? {}) as Record<string, string | undefined>;
  const content = (page.content ?? {}) as any;
  // Icon priority: page icon → header icon logo → store logo → hero image, so a
  // published page always installs with a real icon instead of a blank tile.
  const rawIcon =
    seo["icon"] ||
    content?.header?.iconLogo ||
    page.store?.logo_url ||
    content?.hero?.image ||
    "";
  const icon = absolute(rawIcon ? lpImage(String(rawIcon)) : null, origin);
  const name: string = seo["title"] || page.title || "Landing page";
  const themeColor: string = (page.theme?.primary as string) || "#0f172a";

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
    description: seo["description"] || content?.hero?.subheadline || name,
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
