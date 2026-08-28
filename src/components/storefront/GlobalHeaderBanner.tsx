import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Banner = {
  enabled: boolean;
  image_url: string | null;
  link_url: string | null;
  alt: string | null;
};

export function GlobalHeaderBanner() {
  const { data } = useQuery({
    queryKey: ["platform", "global-header-banner"],
    queryFn: async () => {
      const { data: banner, error } = await supabase
        .from("platform_global_banner" as any)
        .select("enabled,image_url,link_url,alt")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return banner as Banner | null;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!data?.enabled || !data.image_url) return null;

  const image = (
    <img
      src={data.image_url}
      alt={data.alt || "Available payment methods"}
      loading="lazy"
      decoding="async"
      className="mx-auto max-h-16 w-full object-contain"
    />
  );

  return (
    <div className="w-full border-t bg-slate-100 py-3 pb-24 md:pb-3">
      <div className="mx-auto px-3 sm:px-6" style={{ maxWidth: "var(--store-container, 64rem)" }}>
        {data.link_url ? (
          <a href={data.link_url} target="_blank" rel="noreferrer noopener" className="block">
            {image}
          </a>
        ) : image}
      </div>
    </div>
  );
}