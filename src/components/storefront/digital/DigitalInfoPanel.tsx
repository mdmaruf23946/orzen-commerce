import {
  FileArchive,
  HardDrive,
  History,
  Laptop,
  RefreshCw,
  ShieldCheck,
  Zap,
  KeyRound,
} from "lucide-react";
import { prettySize, normalizeDigital } from "@/lib/digital";

type FileRow = {
  label: string;
  version: string | null;
  file_type: string | null;
  file_size: number | null;
};

/** Replaces the shipping/warranty blocks on a digital product page. */
export function DigitalInfoPanel({
  files,
  digital,
  meta,
  updatedAt,
}: {
  files: FileRow[];
  digital: any;
  meta: Record<string, any>;
  updatedAt?: string | null;
}) {
  const cfg = normalizeDigital(digital);
  const version = files.find((f) => f.version)?.version ?? meta.version ?? null;
  const totalSize = files.reduce((n, f) => n + (f.file_size ?? 0), 0);
  const formats = Array.from(
    new Set(files.map((f) => (f.file_type || "").replace(/^\./, "").toUpperCase()).filter(Boolean)),
  );
  const compatible: string[] = Array.isArray(meta.compatible) ? meta.compatible.filter(Boolean) : [];
  const requirements: string[] = Array.isArray(meta.requirements)
    ? meta.requirements.filter(Boolean)
    : [];
  const changelog: string | null = meta.changelog ? String(meta.changelog) : null;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Fact icon={<Zap className="h-4 w-4" />} label="Delivery" value={cfg.delivery === "manual" ? "After approval" : "Instant"} />
        <Fact icon={<History className="h-4 w-4" />} label="Version" value={version ? `v${version}` : "—"} />
        <Fact icon={<HardDrive className="h-4 w-4" />} label="Size" value={prettySize(totalSize)} />
        <Fact
          icon={<RefreshCw className="h-4 w-4" />}
          label="Updated"
          value={updatedAt ? new Date(updatedAt).toLocaleDateString() : "—"}
        />
      </div>

      {files.length > 0 && (
        <Card title="Included files" icon={<FileArchive className="h-4 w-4" />}>
          <ul className="divide-y divide-border/60">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{f.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[f.file_type?.toUpperCase(), f.version ? `v${f.version}` : null, prettySize(f.file_size)]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {formats.length > 0 && (
        <Card title="File formats" icon={<FileArchive className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-1.5">
            {formats.map((f) => (
              <span key={f} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                {f}
              </span>
            ))}
          </div>
        </Card>
      )}

      {compatible.length > 0 && (
        <Card title="Compatibility" icon={<Laptop className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-1.5">
            {compatible.map((c) => (
              <span key={c} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                {c}
              </span>
            ))}
          </div>
        </Card>
      )}

      {requirements.length > 0 && (
        <Card title="Requirements" icon={<ShieldCheck className="h-4 w-4" />}>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {changelog && (
        <Card title="Changelog" icon={<History className="h-4 w-4" />}>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
            {changelog}
          </pre>
        </Card>
      )}

      <Card title="Download information" icon={<ShieldCheck className="h-4 w-4" />}>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            {cfg.delivery === "manual"
              ? "Access is released by the seller after the order is reviewed."
              : "Your download unlocks immediately after payment."}
          </li>
          <li>
            {cfg.download_limit
              ? `Up to ${cfg.download_limit} downloads per file.`
              : "Unlimited re-downloads from your account."}
          </li>
          <li>
            {cfg.expiry_days
              ? `Access stays open for ${cfg.expiry_days} days.`
              : "Access never expires."}
          </li>
          {cfg.license_enabled && (
            <li className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> A license key is delivered with your purchase.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}
