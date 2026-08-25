import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Monitor, Smartphone, Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  listShowcaseAdmin,
  saveShowcase,
  SHOWCASE_KEYS,
  SHOWCASE_LABELS,
  type ShowcaseKey,
  type ShowcaseRow,
} from "@/lib/showcase.functions";

export const Route = createFileRoute("/_authenticated/owner/showcase")({
  component: ShowcasePage,
  head: () => ({
    meta: [
      { title: "Showcase Mockups | ORZEN Owner" },
      {
        name: "description",
        content: "Upload the desktop and mobile screenshots shown in the ORZEN landing page product showcase.",
      },
      { property: "og:title", content: "Showcase Mockups | ORZEN Owner" },
      {
        property: "og:description",
        content: "Manage the landing page product showcase screenshots for every panel tab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = Record<ShowcaseKey, { desktop_url: string | null; mobile_url: string | null }>;

const EMPTY: Draft = SHOWCASE_KEYS.reduce((acc, k) => {
  acc[k] = { desktop_url: null, mobile_url: null };
  return acc;
}, {} as Draft);

function ShowcasePage() {
  const qc = useQueryClient();
  const list = useServerFn(listShowcaseAdmin);
  const save = useServerFn(saveShowcase);

  const { data } = useQuery({ queryKey: ["owner", "showcase"], queryFn: () => list() });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Draft = { ...EMPTY };
    for (const row of data as ShowcaseRow[]) {
      if ((SHOWCASE_KEYS as readonly string[]).includes(row.key)) {
        next[row.key as ShowcaseKey] = {
          desktop_url: row.desktop_url ?? null,
          mobile_url: row.mobile_url ?? null,
        };
      }
    }
    setDraft(next);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          rows: SHOWCASE_KEYS.map((k) => ({
            key: k,
            desktop_url: draft[k].desktop_url,
            mobile_url: draft[k].mobile_url,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Showcase screenshots saved");
      qc.invalidateQueries({ queryKey: ["owner", "showcase"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  async function upload(key: ShowcaseKey, field: "desktop_url" | "mobile_url", file: File) {
    const id = `${key}-${field}`;
    setUploading(id);
    try {
      const toUpload = await compressImage(file, {
        maxEdge: field === "desktop_url" ? 1600 : 900,
        quality: 0.9,
      });
      const ext =
        (toUpload.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) ||
        "jpg";
      const path = `platform-showcase/${key}-${field === "desktop_url" ? "desktop" : "mobile"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(path, toUpload, { upsert: true, contentType: toUpload.type });
      if (error) throw new Error(error.message);
      setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: `/api/img/${path}` } }));
      toast.success("Screenshot uploaded — remember to save");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Showcase Mockups</h1>
          <p className="text-sm text-muted-foreground">
            These screenshots power the “প্রতিটি স্ক্রিন, একই যত্নে তৈরি” section on the landing page.
            Tabs without an upload fall back to the built-in preview.
          </p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SHOWCASE_KEYS.map((key) => (
          <Card key={key}>
            <CardContent className="space-y-4 p-4">
              <div className="text-sm font-semibold">{SHOWCASE_LABELS[key]}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Slot
                  icon={<Monitor className="h-3.5 w-3.5" />}
                  title="Desktop view"
                  hint="Recommended 1600×1000"
                  aspect="aspect-[16/10]"
                  url={draft[key].desktop_url}
                  busy={uploading === `${key}-desktop_url`}
                  onFile={(f) => upload(key, "desktop_url", f)}
                  onClear={() => setDraft((d) => ({ ...d, [key]: { ...d[key], desktop_url: null } }))}
                />
                <Slot
                  icon={<Smartphone className="h-3.5 w-3.5" />}
                  title="Mobile view"
                  hint="Recommended 430×930"
                  aspect="aspect-[9/19.5]"
                  url={draft[key].mobile_url}
                  busy={uploading === `${key}-mobile_url`}
                  onFile={(f) => upload(key, "mobile_url", f)}
                  onClear={() => setDraft((d) => ({ ...d, [key]: { ...d[key], mobile_url: null } }))}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Slot({
  icon,
  title,
  hint,
  aspect,
  url,
  busy,
  onFile,
  onClear,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  aspect: string;
  url: string | null;
  busy: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className={`${aspect} w-full overflow-hidden rounded-lg border bg-muted/40`}>
        {url ? (
          <img src={url} alt={title} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] text-muted-foreground">
            No image — using default
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild disabled={busy}>
          <label className="cursor-pointer">
            {busy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-2 h-3.5 w-3.5" />
            )}
            {url ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
        {url && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
