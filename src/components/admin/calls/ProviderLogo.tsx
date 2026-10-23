// Official brand logos for call providers (absolute origin so Cloudflare production serves the image).
import brilliant from "@/assets/call-providers/brilliant.png.asset.json";
import btcl from "@/assets/call-providers/btcl.png.asset.json";
import amberit from "@/assets/call-providers/amberit.png.asset.json";
import link3 from "@/assets/call-providers/link3.png.asset.json";
import bdcom from "@/assets/call-providers/bdcom.png.asset.json";
import ummah from "@/assets/call-providers/ummah.png.asset.json";
import { Settings2 } from "lucide-react";

const ORIGIN = "https://orzen-commerce.lovable.app";
const LOGOS: Record<string, string> = {
  brilliant: brilliant.url, btcl: btcl.url, amberit: amberit.url, link3: link3.url, bdcom: bdcom.url, ummah: ummah.url,
};

export function ProviderLogo({ id, name, className = "h-11 w-11" }: { id: string; name: string; className?: string }) {
  const url = LOGOS[id];
  if (url) {
    return (
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card p-1 ${className}`}>
        <img src={`${ORIGIN}${url}`} alt={`${name} logo`} className="max-h-full max-w-full object-contain" loading="lazy" />
      </div>
    );
  }
  if (id === "custom") {
    return <div className={`flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${className}`}><Settings2 className="h-1/2 w-1/2" /></div>;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary ${className}`} aria-label={`${name} logo`}>
      {name.slice(0, 2)}
    </div>
  );
}
