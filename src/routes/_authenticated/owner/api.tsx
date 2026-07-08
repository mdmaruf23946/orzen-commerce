import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Copy, KeyRound } from "lucide-react";
import { listApiKeys, createApiKey, revokeApiKey, deleteApiKey } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/api")({ component: Page });

function Page() {
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const del = useServerFn(deleteApiKey);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "apiKeys"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  async function submit() {
    try {
      const r = await create({ data: { name, scopes: ["read"] } });
      setIssued(r.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["owner", "apiKeys"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <OwnerPageHeader title="API Keys" description="Owner-issued keys for external integrations."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setIssued(null); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New key</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{issued ? "Copy your key" : "Create API key"}</DialogTitle></DialogHeader>
              {!issued ? (
                <>
                  <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Integration name" /></div>
                  <DialogFooter><Button onClick={submit} disabled={!name}>Generate</Button></DialogFooter>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Save this key now — it will not be shown again.</p>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 font-mono text-xs">
                    <span className="truncate">{issued}</span>
                    <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(issued); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <DialogFooter><Button onClick={() => { setOpen(false); setIssued(null); }}>Done</Button></DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      {(data as any[]).length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <KeyRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Prefix</th><th className="px-3 py-2 text-left">Created</th><th className="px-3 py-2 text-left">Last used</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {(data as any[]).map((k) => (
                <tr key={k.id} className="border-t">
                  <td className="px-3 py-2">{k.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">lvbl_{k.prefix}…</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">{k.revoked_at ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">Revoked</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Active</span>}</td>
                  <td className="px-3 py-2 text-right">
                    {!k.revoked_at && <Button size="sm" variant="outline" onClick={async () => { await revoke({ data: { id: k.id } }); qc.invalidateQueries({ queryKey: ["owner", "apiKeys"] }); }}>Revoke</Button>}
                    <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await del({ data: { id: k.id } }); qc.invalidateQueries({ queryKey: ["owner", "apiKeys"] }); } }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
