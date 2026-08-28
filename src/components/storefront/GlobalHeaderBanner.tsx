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
      className="max-h-7 w-full object-contain sm:max-h-9"
    />
  );

  return (
    <div className="flex w-full items-center justify-center bg-[#0A192F] py-3 px-4 pb-24 md:pb-3">
      <div className="w-full" style={{ maxWidth: "var(--store-container, 64rem)" }}>
        {data.link_url ? (
          <a href={data.link_url} target="_blank" rel="noreferrer noopener" className="block">
            {image}
          </a>
        ) : image}
      </div>
    </div>
  );
}