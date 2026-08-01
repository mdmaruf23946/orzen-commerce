import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  listDigitalCatalog,
  ownerUpsertDigitalCategory,
  ownerDeleteDigitalCategory,
} from "@/lib/digital.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/digital-categories")({
  head: () => ({
    meta: [
      { title: "Digital Categories — ORZEN Admin" },
      {
        name: "description",
        content: "Manage the global digital category catalog every ORZEN digital store can sell in.",
      },
      { property: "og:title", content: "Digital Categories — ORZEN Admin" },
      { property: "og:description", content: "Global digital marketplace category catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerDigitalCategories,
});

function OwnerDigitalCategories() {
  const qc = useQueryClient();
  const list = useServerFn(listDigitalCatalog);
  const upsert = useServerFn(ownerUpsertDigitalCategory);
  const del = useServerFn(ownerDeleteDigitalCategory);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["owner", "digital-categories"],
    queryFn: () => list(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["owner", "digital-categories"] });

  const run = async (fn: () => Promise<any>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Digital Categories</h1>
        <p className="text-sm text-muted-foreground">
          The global catalog every digital store sells in. Stores can hide or rename these locally.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
        <div className="min-w-40 flex-1">
          <label className="text-xs font-medium">Key</label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ui-kits" />
        </div>
        <div className="min-w-40 flex-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="UI Kits" />
        </div>
        <Button
          onClick={() =>
            run(async () => {
              await upsert({
                data: {
                  key: key.trim().toLowerCase(),
                  name: name.trim(),
                  sort_order: ((data as any[]).length + 1) * 10,
                },
              });
              setKey("");
              setName("");
            }, "Category added")
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {(data as any[]).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.key}</div>
              </div>
              <Input
                className="h-8 w-20"
                type="number"
                defaultValue={c.sort_order ?? 0}
                onBlur={(e) =>
                  run(
                    () =>
                      upsert({
                        data: {
                          id: c.id,
                          key: c.key,
                          name: c.name,
                          icon: c.icon,
                          description: c.description,
                          sort_order: Number(e.target.value) || 0,
                          is_active: c.is_active,
                        },
                      }),
                    "Order updated",
                  )
                }
              />
              <Switch
                checked={!!c.is_active}
                onCheckedChange={(v) =>
                  run(
                    () =>
                      upsert({
                        data: {
                          id: c.id,
                          key: c.key,
                          name: c.name,
                          icon: c.icon,
                          description: c.description,
                          sort_order: c.sort_order ?? 0,
                          is_active: v,
                        },
                      }),
                    v ? "Category enabled" : "Category hidden",
                  )
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete category"
                onClick={() => run(() => del({ data: { id: c.id } }), "Category deleted")}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
