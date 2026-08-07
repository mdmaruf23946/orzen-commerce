import { Globe } from "lucide-react";

export function GooglePreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url?: string | null;
}) {
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Google preview</h3>
      <div className="rounded-lg border bg-background p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          <span className="truncate">{(url ?? "").replace(/^https?:\/\//, "") || "your-store.com"}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-[17px] leading-tight text-[#1a0dab]">{title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}

export function SocialPreview({
  title,
  description,
  image,
  url,
  variant,
}: {
  title: string;
  description: string;
  image?: string | null;
  url?: string | null;
  variant: "facebook" | "x";
}) {
  const host = (url ?? "").replace(/^https?:\/\//, "").split("/")[0] || "your-store.com";
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="aspect-[1.91/1] w-full bg-muted">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No image set
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{host}</p>
        <p className="line-clamp-1 text-sm font-semibold">{title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        <p className="text-[11px] text-muted-foreground">
          {variant === "facebook" ? "Facebook / Messenger" : "X (Twitter)"}
        </p>
      </div>
    </div>
  );
}
