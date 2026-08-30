import { ExternalLink, Bot, ShoppingBag, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500";
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] md:text-[11px] font-medium text-foreground/80",
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] md:text-[11px] font-medium",
        styles,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

function AiIllustration({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative flex items-center justify-center", className)}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/25 via-indigo-400/15 to-blue-400/10 blur-2xl" />
      <svg
        width="150"
        height="120"
        viewBox="0 0 180 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="relative"
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
        <circle cx="20" cy="30" r="4" fill="#c4b5fd" opacity="0.7" />
        <circle cx="160" cy="120" r="3" fill="#93c5fd" opacity="0.8" />
        <rect x="150" y="20" width="8" height="8" rx="2" fill="#a78bfa" opacity="0.6" transform="rotate(20 154 24)" />
        <g transform="translate(6 90)">
          <rect x="0" y="24" width="6" height="14" rx="1.5" fill="#c4b5fd" />
          <rect x="9" y="14" width="6" height="24" rx="1.5" fill="#a78bfa" />
          <rect x="18" y="6" width="6" height="32" rx="1.5" fill="oklch(0.52 0.22 275)" />
          <rect x="27" y="18" width="6" height="20" rx="1.5" fill="#818cf8" />
        </g>
        <g transform="translate(120 6)">
          <rect x="0" y="0" width="52" height="26" rx="13" fill="white" stroke="#e0e7ff" />
          <circle cx="14" cy="13" r="2.2" fill="#818cf8" />
          <circle cx="22" cy="13" r="2.2" fill="#a78bfa" />
          <circle cx="30" cy="13" r="2.2" fill="#c4b5fd" />
        </g>
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
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1.5 sm:px-3 sm:py-2">
      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] md:text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", tone)} />
        <span className="whitespace-normal leading-tight break-words">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-base sm:text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function WelcomeCard(props: WelcomeCardProps) {
  const { ownerName, store, storeUrl, today, products, inbox, updatedRel } = props;

  const fmtBDT = (n: number) => `৳${(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
  const nFmt = (n: number) => (n ?? 0).toLocaleString("en-BD");

  const messagesCount = inbox?.today ?? 0;
  const aiRepliesCount = inbox?.ai_replied ?? 0;

  const badges = (
    <div
      className="flex flex-nowrap items-center gap-2 overflow-x-auto md:mb-2 lg:mb-3"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <StatusChip tone="emerald">Active Store</StatusChip>
      {store?.package_name && (
        <Chip className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700">
          {store.package_name}
        </Chip>
      )}
      <Chip className="text-muted-foreground">Updated {updatedRel}</Chip>
      <StatusChip tone="emerald">AI Online</StatusChip>
    </div>
  );

  const stats = [
    { icon: ShoppingBag, label: "Orders", value: nFmt(today.orders), tone: "text-blue-600" },
    { icon: MessageSquare, label: "Messages", value: nFmt(messagesCount), tone: "text-indigo-600" },
    { icon: Bot, label: "AI Replies", value: nFmt(aiRepliesCount), tone: "text-purple-600" },
    { icon: TrendingUp, label: "Today's Sales", value: fmtBDT(today.sales), tone: "text-emerald-600" },
  ];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-[#ECECEC] dark:border-white/10",
        "bg-gradient-to-br from-primary/5 via-background to-accent/40 dark:from-primary/10 dark:via-card/70 dark:to-accent/20",
        "shadow-[0_8px_30px_-12px_rgba(80,70,229,0.18)]",
      )}
    >
      {/* Decorative overlays */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />

      {/* ============ DESKTOP / TABLET (md+) ============ */}
      <div className="relative hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start md:gap-5 md:p-5 lg:p-6">
        {/* LEFT — welcome + badges pinned to top */}
        <div className="min-w-0 self-start">
          <h1 className="truncate text-xl font-semibold tracking-tight lg:text-[26px] lg:leading-tight">
            👋 Welcome back, {ownerName}!
          </h1>
          {badges}
        </div>

        {/* CENTER — 4 stats pinned to bottom */}
        <div className="min-w-0 self-end">
          <div className="grid grid-cols-4 gap-2.5">
            {stats.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>
        </div>

        {/* RIGHT — Illustration + CTA pinned to bottom */}
        <div className="relative flex shrink-0 flex-col items-end gap-2 self-end">
          <a
            href={storeUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40"
          >
            View Store <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <AiIllustration className="h-24 w-36 md:scale-75 lg:scale-100" />
        </div>
      </div>

      {/* ============ MOBILE (<md) — dedicated layout ============ */}
      <div className="relative block space-y-3 p-4 md:hidden">
        {/* Row 1: title with small AI glyph */}
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
            👋 Welcome back, {ownerName}
          </h1>
        </div>

        {/* Row 2: badges */}
        {badges}

        {/* Row 3: 2x2 stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <StatTile key={s.label} {...s} />
          ))}
        </div>

        {/* Row 4: full-width View Store CTA */}
        {store && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/30 active:scale-[0.98]"
          >
            View Store <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </section>
  );
}
