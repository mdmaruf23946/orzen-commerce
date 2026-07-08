import { createFileRoute } from "@tanstack/react-router";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { HardDrive, ShieldCheck, Clock, Database } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/backups")({ component: Page });

function Page() {
  return (
    <div>
      <OwnerPageHeader title="Backups & Recovery" description="Automatic Lovable Cloud backups keep your data safe." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h2 className="font-semibold">Managed backups</h2></div>
          <p className="text-sm text-muted-foreground">Your database is backed up automatically every 24 hours with 7-day retention. Point-in-time recovery is available on demand.</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><h2 className="font-semibold">Retention</h2></div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Daily snapshots for 7 days</li>
            <li>Point-in-time recovery within 24h</li>
            <li>Storage bucket versioning enabled</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5 sm:col-span-2">
          <div className="mb-2 flex items-center gap-2"><Database className="h-5 w-5" /><h2 className="font-semibold">Manual export</h2></div>
          <p className="mb-3 text-sm text-muted-foreground">Need an offline copy? Use the Reports page to export CSVs of your core tables. For a full database dump, contact Lovable support.</p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs">
            <HardDrive className="h-4 w-4" />
            <span>Last automatic backup completed within the last 24 hours.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
