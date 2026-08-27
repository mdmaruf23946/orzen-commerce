import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGlobalHeaderBanner } from "@/lib/global-banner.functions";

/**
 * Platform-wide announcement / payment strip.
 * Controlled exclusively from the Owner Admin Panel; merchants cannot change it.
 */
export function GlobalHeaderBanner() {
  const fetchBanner = useServerFn(getGlobalHeaderBanner);
  const { data } = useQuery({
    queryKey: ["platform", "global-header-banner"],
    queryFn: () => fetchBanner(),
    staleTime: 10 * 60 * 1000,
  });

  if (!data?.enabled || !data.image_url) return null;

  const img = (
    <img
      src={data.image_url}
      alt={data.alt || "Payment options"}
      loading="lazy"
      decoding="async"
      className="mx-auto max-h-10 w-full object-contain"
    />
  );

  return (
    <div className="w-full border-b border-gray-100 bg-white py-1">
      <div className="mx-auto px-3 sm:px-6" style={{ maxWidth: "var(--store-container, 64rem)" }}>
        {data.link_url ? (
          <a href={data.link_url} target="_blank" rel="noreferrer noopener" className="block">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    </div>
  );
}
