import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { listDisconnectedDomains } from "@/lib/store-mode.functions";

/** Shown while a custom domain is archived after a Store Mode change. */
export function DomainDisconnectedBanner() {
  const fn = useServerFn(listDisconnectedDomains);
  const { data } = useQuery({
    queryKey: ["admin", "disconnected-domains"],
    queryFn: () => fn(),
  });
  const rows = ((data as any[]) ?? []).filter((d) => d.disconnect_reason === "store_mode_changed");
  if (!rows.length) return null;

  return (
    <div className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Your custom domain{rows.length > 1 ? "s" : ""} ({rows.map((d) => d.hostname).join(", ")}) ha
        {rows.length > 1 ? "ve" : "s"} been disconnected because the Store Mode changed. Please
        reconnect your domain for the new Store Mode in{" "}
        <Link to="/admin/domains" className="font-medium underline">
          Store Settings → Domains
        </Link>
        .
      </span>
    </div>
  );
}
