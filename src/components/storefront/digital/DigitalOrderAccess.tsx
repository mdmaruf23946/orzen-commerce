import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, KeyRound, Copy, Clock, FileDown, LifeBuoy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrderDigitalAccess, requestDigitalDownload } from "@/lib/digital.functions";
import { formatBytes, LICENSE_LABELS, type LicenseType } from "@/lib/digital";
import { getDeviceId } from "@/lib/fingerprint";
import { readToken } from "@/lib/customer-session";

const contactKey = (orderId: string) => `orzen_order_contact__${orderId}`;

function readContact(orderId: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(contactKey(orderId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Post-payment access panel shown on the order page: files, license keys
 * and the remaining download allowance for every digital item.
 * License keys and download links require proof of ownership — a customer
 * session, or the phone/email used on the order.
 */
export function DigitalOrderAccess({
  orderId,
  slug,
  storeId,
}: {
  orderId: string;
  slug?: string;
  storeId?: string;
}) {
  const listAccess = useServerFn(getOrderDigitalAccess);
  const requestDl = useServerFn(requestDigitalDownload);
  const [busy, setBusy] = useState<string | null>(null);
  const [contact, setContact] = useState(() => readContact(orderId));
  const [contactInput, setContactInput] = useState("");
  const token = slug ? readToken(slug) : null;

  const { data: items = [], refetch } = useQuery({
    queryKey: ["digitalAccess", orderId, contact, token],
    queryFn: () =>
      listAccess({
        data: {
          orderId,
          ...(storeId ? { storeId } : {}),
          ...(token ? { token } : {}),
          ...(contact ? { contact } : {}),
        },
      }),
  });

  if (!items.length) return null;

  const verified = (items as any[]).some((i) => i.verified);

  function submitContact(e: React.FormEvent) {
    e.preventDefault();
    const value = contactInput.trim();
    if (!value) return;
    try {
      window.localStorage.setItem(contactKey(orderId), value);
    } catch {
      /* ignore */
    }
    setContact(value);
  }

  async function download(entitlementId: string, fileIndex: number) {
    const key = `${entitlementId}:${fileIndex}`;
    setBusy(key);
    try {
      const res = await requestDl({
        data: {
          entitlementId,
          fileIndex,
          orderId,
          ...(storeId ? { storeId } : {}),
          ...(token ? { token } : {}),
          ...(contact ? { contact } : {}),
          deviceId: getDeviceId() || undefined,
        },
      });
      window.open(res.url, "_blank", "noopener");
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Download className="h-3 w-3" /> Your downloads
      </div>

      {!verified && (
        <form
          onSubmit={submitContact}
          className="mb-4 rounded-lg border bg-muted/30 p-3 space-y-2"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" /> Verify it's your order
          </p>
          <p className="text-[11px] text-muted-foreground">
            Enter the phone number or email you used at checkout to unlock license keys and
            download links.
          </p>
          <div className="flex gap-2">
            <Input
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Phone or email"
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9">
              Unlock
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-4">

        {(items as any[]).map((it) => {
          const locked = it.status !== "active";
          const remaining =
            it.maxDownloads == null ? null : Math.max(0, it.maxDownloads - it.downloadCount);
          return (
            <div key={it.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.version ? `Version ${it.version}` : "Latest version"}
                    {it.license ? ` · ${LICENSE_LABELS[(it.license.type ?? "personal") as LicenseType]}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    locked ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {locked ? "Awaiting payment" : "Ready to download"}
                </span>
              </div>

              {!locked && verified && (
                <div className="mt-3 space-y-2">
                  {(it.files as any[]).map((f) => (
                    <div
                      key={f.index}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{f.name}</p>
                        {f.size ? (
                          <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => download(it.id, f.index)}
                        disabled={busy === `${it.id}:${f.index}`}
                      >
                        <FileDown className="mr-1 h-3.5 w-3.5" />
                        {busy === `${it.id}:${f.index}` ? "…" : "Download"}
                      </Button>
                    </div>
                  ))}
                  {it.hasExternal && (
                    <Button size="sm" variant="outline" onClick={() => download(it.id, -1)}>
                      Open external link
                    </Button>
                  )}
                </div>
              )}

              {it.license && (
                <div className="mt-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="flex-1 truncate text-xs">{it.license.key}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(it.license.key);
                      toast.success("License copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span>
                  Downloads: {it.downloadCount}
                  {it.maxDownloads == null ? " (unlimited)" : ` / ${it.maxDownloads}`}
                </span>
                {remaining != null && <span>Remaining: {remaining}</span>}
                {it.expiresAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Expires {new Date(it.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LifeBuoy className="h-3 w-3" /> Download links are personal and expire shortly after being
        created.
      </p>
    </div>
  );
}
