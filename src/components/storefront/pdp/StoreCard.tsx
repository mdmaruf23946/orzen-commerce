import { Link } from "@tanstack/react-router";
import { Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoreCard({
  slug,
  name,
  logoUrl,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
}) {
  return (
    <section className="mt-8 flex items-center gap-4 rounded-2xl border bg-white p-4">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
        {logoUrl ? (
          <img src={logoUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <StoreIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Sold by</p>
        <p className="truncate text-sm font-semibold">{name}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/store/$slug" params={{ slug }}>Visit Store</Link>
      </Button>
    </section>
  );
}
