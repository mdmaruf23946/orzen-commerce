import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { aiAddIdentity, aiGetOverview, aiRemoveIdentity } from "@/lib/merchant-ai.functions";

export const Route = createFileRoute("/_authenticated/admin/ai/identity")({
  head: () => ({
    meta: [
      { title: "Merchant Identity — ORZEN Merchant Panel" },
      { name: "description", content: "Verify which Messenger or WhatsApp account can command your store." },
      { property: "og:title", content: "Merchant Identity — ORZEN Merchant Panel" },
      { property: "og:description", content: "Verify which Messenger or WhatsApp account can command your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="ai_agent">
      <IdentityPage />
    </FeatureGate>
  ),
});

function IdentityPage() {
  const overviewFn = useServerFn(aiGetOverview);
  const addFn = useServerFn(aiAddIdentity);
  const removeFn = useServerFn(aiRemoveIdentity);
  const qc = useQueryClient();

  const [channel, setChannel] = useState<"messenger" | "whatsapp">("whatsapp");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["ai-cc-overview"], queryFn: () => overviewFn() });

  async function add() {
    try {
      const res = await addFn({ data: { channel, identifier, label: label || undefined } });
      setCode(res.code);
      setIdentifier("");
      setLabel("");
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await removeFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["ai-cc-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const identities = data?.identities ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <KeyRound className="h-6 w-6" /> Merchant Identity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only verified accounts can control your store from chat. Everyone else is treated as a customer —
          no matter what they claim.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="messenger">Messenger</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={channel === "whatsapp" ? "8801700000000" : "Messenger PSID"}
          />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Owner)" />
          <Button onClick={add} disabled={identifier.trim().length < 3}>
            Add
          </Button>
        </div>
        {code && (
          <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
            Send this code from that account to your own {channel === "whatsapp" ? "WhatsApp" : "Messenger"} number
            within 30 minutes to finish verification: <span className="font-mono text-base font-semibold">{code}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          {identities.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No identities added yet.</li>
          )}
          {identities.map((i: any) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {i.label || i.identifier}{" "}
                  <span className="text-xs font-normal text-muted-foreground">({i.channel})</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{i.identifier}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    i.verified
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {i.verified ? "Verified" : "Pending"}
                </span>
                <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
