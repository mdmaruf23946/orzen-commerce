import { ExternalLink, Copy, Bot, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-reveal";

type InboxStats = {
  unread?: number;
  today?: number;
  ai_replied?: number;
  human_replied?: number;
  failed?: number;
} | null | undefined;

type LowStockSample = { name: string; stock: number } | null | undefined;

export type WelcomeCardProps = {
  ownerName: string;
  store: {
    slug: string;
    status?: string | null;
    package_name?: string | null;
    updated_at?: string | null;
  } | null;
  storeUrl: string;
  onCopy: () => void;
  today: {
    sales: number;
    orders: number;
    salesPct: number;
    ordersPct: number;
    pendingOrders: number;
  };
  products: { total: number; lowStock: number; outOfStock: number };
  inbox: InboxStats;
  lowStockSample: LowStockSample;
  updatedRel: string;
};

function StatusDot({ tone = "emerald" as "emerald" | "amber" | "red" }) {
  const color =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-red-500";
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      <span className={cn("absolute inset-0 rounded-full opacity-60 animate-status-pulse", color)} />
      <span className={cn("relative inline-block h-1.5 w-1.5 rounded-full", color)} />
    </span>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-foreground/80 backdrop-blur",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "red";
  children: React.ReactNode;
}) {
  const styles =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-amber-100 dark:border-amber-500/20"
      : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300 border-red-100 dark:border-red-500/20";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        styles,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

function Num({ value }: { value: number }) {
  const [start, setStart] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setStart(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const v = useCountUp(value, start, 900);
  return <span className="font-semibold tabular-nums">{v.toLocaleString("en-BD")}</span>;
}

function AiIllustration() {
  return (
    <div className="pointer-events-none relative hidden h-full w-full items-center justify-center md:flex">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/25 via-indigo-400/15 to-blue-400/10 blur-2xl" />
      <div className="animate-orzen-float relative">
        <svg
          width="180"
          height="150"
          viewBox="0 0 180 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="botBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.62 0.22 275)" />
              <stop offset="100%" stopColor="oklch(0.52 0.22 275)" />
            </linearGradient>
            <linearGradient id="botScreen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          {/* floating shapes */}
          <circle cx="20" cy="30" r="4" fill="#c4b5fd" opacity="0.7" />
          <circle cx="160" cy="120" r="3" fill="#93c5fd" opacity="0.8" />
          <rect x="150" y="20" width="8" height="8" rx="2" fill="#a78bfa" opacity="0.6" transform="rotate(20 154 24)" />
          {/* analytics mini chart */}
          <g transform="translate(6 90)">
            <rect x="0" y="24" width="6" height="14" rx="1.5" fill="#c4b5fd" />
            <rect x="9" y="14" width="6" height="24" rx="1.5" fill="#a78bfa" />
            <rect x="18" y="6" width="6" height="32" rx="1.5" fill="oklch(0.52 0.22 275)" />
            <rect x="27" y="18" width="6" height="20" rx="1.5" fill="#818cf8" />
          </g>
          {/* chat bubble */}
          <g transform="translate(120 6)">
            <rect x="0" y="0" width="52" height="26" rx="13" fill="white" stroke="#e0e7ff" />
            <circle cx="14" cy="13" r="2.2" fill="#818cf8" />
            <circle cx="22" cy="13" r="2.2" fill="#a78bfa" />
            <circle cx="30" cy="13" r="2.2" fill="#c4b5fd" />
          </g>
          {/* robot */}
          <g transform="translate(52 34)">
            <rect x="10" y="0" width="60" height="10" rx="5" fill="#c7d2fe" />
            <circle cx="40" cy="-2" r="3" fill="#818cf8" />
            <rect x="0" y="10" width="80" height="60" rx="18" fill="url(#botBody)" />
            <rect x="10" y="20" width="60" height="36" rx="10" fill="url(#botScreen)" />
            <circle cx="28" cy="38" r="4" fill="white" />
            <circle cx="52" cy="38" r="4" fill="white" />
            <rect x="30" y="48" width="20" height="3" rx="1.5" fill="white" opacity="0.85" />
            <rect x="18" y="72" width="44" height="8" rx="4" fill="#c7d2fe" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export function WelcomeCard(props: WelcomeCardProps) {
  const {
    ownerName,
    store,
    storeUrl,
    onCopy,
    today,
    products,
    inbox,
    lowStockSample,
    updatedRel,
  } = props;

  const revenueUp = (today.salesPct ?? 0) >= 0;
  const revenueAbs = Math.abs(today.salesPct ?? 0);

  // Build dynamic summary bullets — omit zeros silently
  const bullets: React.ReactNode[] = [];
  if (today.orders > 0) bullets.push(<><Num value={today.orders} /> new orders</>);
  if ((inbox?.today ?? 0) > 0)
    bullets.push(<><Num value={inbox!.today!} /> new Messenger messages</>);
  if ((inbox?.ai_replied ?? 0) > 0)
    bullets.push(<>AI replied to <Num value={inbox!.ai_replied!} /> customers</>);
  if ((inbox?.human_replied ?? 0) > 0)
    bullets.push(<><Num value={inbox!.human_replied!} /> handled by human support</>);
  if (today.sales > 0)
    bullets.push(
      <>
        Total sales today <span className="font-semibold">৳{today.sales.toLocaleString("en-BD")}</span>
      </>,
    );
  if (today.salesPct !== 0)
    bullets.push(
      <>
        Revenue {revenueUp ? "increased" : "decreased"} by{" "}
        <span className={cn("font-semibold", revenueUp ? "text-emerald-600" : "text-red-600")}>
          {revenueAbs}%
        </span>{" "}
        vs yesterday
      </>,
    );

  // Insight
  let insight: string;
  if (lowStockSample) {
    insight = `${lowStockSample.name} is running low — only ${lowStockSample.stock} left. Consider restocking soon.`;
  } else if ((today.ordersPct ?? 0) > 20) {
    insight = `Order volume is up ${today.ordersPct}% today — great momentum, keep the pipeline warm.`;
  } else if ((inbox?.unread ?? 0) > 0) {
    insight = `You have ${inbox!.unread} unread Messenger thread${inbox!.unread! > 1 ? "s" : ""} waiting for a reply.`;
  } else if (today.pendingOrders > 0) {
    insight = `${today.pendingOrders} order${today.pendingOrders > 1 ? "s are" : " is"} pending confirmation — process them to keep customers happy.`;
  } else {
    insight = "All quiet — a good time to publish a new product or launch a coupon.";
  }

  // Status chips derived from real signals only
  const productsReady = products.total > 0;
  const messengerConnected = (inbox?.today ?? 0) + (inbox?.ai_replied ?? 0) + (inbox?.human_replied ?? 0) + (inbox?.unread ?? 0) > 0
    ? "emerald"
    : inbox === undefined
    ? null
    : "amber"; // stats returned but no activity
  const inventoryTone: "emerald" | "amber" | "red" =
    !productsReady ? "red" : products.outOfStock > 0 ? "amber" : "emerald";

  return (
    <section
      className={cn(
        "animate-welcome-fade-in relative overflow-hidden rounded-[22px] border border-[#ECECEC] dark:border-white/10",
        "bg-white/70 dark:bg-card/70 backdrop-blur-xl",
        "shadow-[0_8px_30px_-12px_rgba(80,70,229,0.18)] transition-transform duration-300 hover:-translate-y-0.5",
      )}
    >
      {/* Decorative overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-blue-500/8" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />

      <div className="relative grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_240px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
                👋 Welcome back, {ownerName}!
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Here's your store at a glance.
              </p>
            </div>
            {/* Mobile CTA */}
            {store && (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40 lg:hidden"
              >
                View <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="emerald">Active Store</StatusChip>
            {store?.package_name && <Chip>{store.package_name}</Chip>}
            {store && (
              <Chip className="max-w-[220px]">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  /store/{store.slug}
                </a>
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy store URL"
                  className="ml-1 rounded p-0.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </Chip>
            )}
            <Chip className="text-muted-foreground">Updated {updatedRel}</Chip>
          </div>
        </div>

        {/* CENTER — AI Summary */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight">AI Business Summary</h2>
          </div>
          {bullets.length > 0 ? (
            <ul className="grid gap-1 text-[13px] leading-relaxed text-foreground/85 sm:grid-cols-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No activity yet today — share your store to start receiving orders.
            </p>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-2.5 text-xs text-foreground/85">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                AI Insight
              </div>
              <div className="leading-relaxed">{insight}</div>
            </div>
          </div>
        </div>

        {/* RIGHT — Illustration + desktop CTA */}
        <div className="relative hidden lg:block">
          <a
            href={storeUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="absolute right-0 top-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40"
          >
            View Store <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <AiIllustration />
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="relative border-t border-black/5 dark:border-white/5 px-5 py-3 md:px-6">
        <div className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
          <StatusChip tone="emerald">AI Online</StatusChip>
          {messengerConnected && (
            <StatusChip tone={messengerConnected as "emerald" | "amber"}>
              Messenger {messengerConnected === "emerald" ? "Connected" : "Idle"}
            </StatusChip>
          )}
          {inbox !== undefined && inbox !== null && (
            <StatusChip tone={(inbox.failed ?? 0) > 0 ? "amber" : "emerald"}>
              Webhook {(inbox.failed ?? 0) > 0 ? "Partial" : "Verified"}
            </StatusChip>
          )}
          <StatusChip tone={productsReady ? "emerald" : "amber"}>
            Knowledge {productsReady ? "Synced" : "Pending"}
          </StatusChip>
          <StatusChip tone={productsReady ? "emerald" : "amber"}>
            Product Index {productsReady ? "Ready" : "Empty"}
          </StatusChip>
          <StatusChip tone="emerald">Gateway Connected</StatusChip>
          <StatusChip tone={inventoryTone}>
            Inventory {inventoryTone === "emerald" ? "Synced" : inventoryTone === "amber" ? "Low" : "Empty"}
          </StatusChip>
        </div>
      </div>
    </section>
  );
}
