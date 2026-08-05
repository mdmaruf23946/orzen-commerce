// Store-wide invoice business information. Lives inside the Invoice
// Templates page as a collapsible section — every template renders with it.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { getInvoiceProfile, saveInvoiceProfile } from "@/lib/invoice-settings.functions";
import { cn } from "@/lib/utils";

type Form = {
  business_name: string;
  owner_name: string;
  business_address: string;
  phone: string;
  email: string;
  website: string;
  trade_license: string;
  bin_vat: string;
  logo_url: string;
  signature_url: string;
  seal_url: string;
  thank_you_message: string;
  terms: string;
  refund_policy: string;
  show_logo: boolean;
  show_signature: boolean;
  show_seal: boolean;
  show_terms: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function GlobalInvoiceInfo() {
  const load = useServerFn(getInvoiceProfile);
  const save = useServerFn(saveInvoiceProfile);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form | null>(null);

  const { data } = useQuery({ queryKey: ["invoice-profile"], queryFn: () => load() });

  useEffect(() => {
    if (data?.profile) setForm(data.profile as Form);
  }, [data]);

  const mut = useMutation({
    mutationFn: (f: Form) => save({ data: f as any }),
    onSuccess: () => {
      toast.success("Global invoice information saved");
      qc.invalidateQueries({ queryKey: ["invoice-profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Global Invoice Information</h2>
          <p className="text-xs text-muted-foreground">
            Business details used by every invoice template. Fill this in once.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={data?.exists ? "secondary" : "outline"}>{data?.exists ? "Saved" : "Not set up yet"}</Badge>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-6 border-t p-4">
          {!form ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div>
                <h3 className="mb-3 text-sm font-semibold">Business Information</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Business name" value={form.business_name} onChange={(v) => set("business_name", v)} />
                  <Field label="Owner name" value={form.owner_name} onChange={(v) => set("owner_name", v)} />
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Business address</Label>
                    <Textarea
                      rows={2}
                      value={form.business_address}
                      onChange={(e) => set("business_address", e.target.value)}
                    />
                  </div>
                  <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} />
                  <Field label="Email address" value={form.email} onChange={(v) => set("email", v)} />
                  <Field label="Website" optional value={form.website} onChange={(v) => set("website", v)} />
                  <Field
                    label="Trade license"
                    optional
                    value={form.trade_license}
                    onChange={(v) => set("trade_license", v)}
                  />
                  <Field label="BIN / VAT number" optional value={form.bin_vat} onChange={(v) => set("bin_vat", v)} />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Branding</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company logo</Label>
                    <ImageUploader
                      storeId={data?.storeId}
                      folder={data?.storeId ? `${data.storeId}/invoice` : undefined}
                      value={form.logo_url || null}
                      onChange={(p) => set("logo_url", p ?? "")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Signature (optional)</Label>
                    <ImageUploader
                      storeId={data?.storeId}
                      folder={data?.storeId ? `${data.storeId}/invoice` : undefined}
                      value={form.signature_url || null}
                      onChange={(p) => set("signature_url", p ?? "")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company seal (optional)</Label>
                    <ImageUploader
                      storeId={data?.storeId}
                      folder={data?.storeId ? `${data.storeId}/invoice` : undefined}
                      value={form.seal_url || null}
                      onChange={(p) => set("seal_url", p ?? "")}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Invoice Footer</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Thank you message</Label>
                    <Input
                      value={form.thank_you_message}
                      placeholder="Thank you for shopping with us!"
                      onChange={(e) => set("thank_you_message", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Terms &amp; conditions</Label>
                    <Textarea rows={3} value={form.terms} onChange={(e) => set("terms", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Return / refund policy</Label>
                    <Textarea
                      rows={3}
                      value={form.refund_policy}
                      onChange={(e) => set("refund_policy", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Display Options</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle label="Show logo" checked={form.show_logo} onChange={(v) => set("show_logo", v)} />
                  <Toggle
                    label="Show signature"
                    checked={form.show_signature}
                    onChange={(v) => set("show_signature", v)}
                  />
                  <Toggle label="Show company seal" checked={form.show_seal} onChange={(v) => set("show_seal", v)} />
                  <Toggle
                    label="Show terms & conditions"
                    checked={form.show_terms}
                    onChange={(v) => set("show_terms", v)}
                  />
                </div>
              </div>

              <Button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="w-full sm:w-auto">
                {mut.isPending ? "Saving…" : "Save information"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
