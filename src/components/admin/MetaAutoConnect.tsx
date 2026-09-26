// Auto Connect block shown alongside (never instead of) the manual connect
// form on the Messenger and WhatsApp integration pages.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import {
  startMetaAutoConnect,
  listMetaAutoConnectPages,
  listMetaAutoConnectNumbers,
  autoConnectMessengerPage,
  autoConnectWhatsappNumber,
} from "@/lib/meta-oauth.functions";

type Props = {
  channel: "messenger" | "whatsapp";
  onConnected?: () => void;
};

type PageRow = { id: string; name: string; category: string | null; picture: string | null; can_message: boolean };
type NumberRow = {
  waba_id: string;
  waba_name: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
};

export function MetaAutoConnect({ channel, onConnected }: Props) {
  const start = useServerFn(startMetaAutoConnect);
  const loadPages = useServerFn(listMetaAutoConnectPages);
  const loadNumbers = useServerFn(listMetaAutoConnectNumbers);
  const finishPage = useServerFn(autoConnectMessengerPage);
  const finishNumber = useServerFn(autoConnectWhatsappNumber);

  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [numbers, setNumbers] = useState<NumberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Facebook sends the merchant back here with ?meta_session=...&meta_result=ok
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("meta_session");
    const result = params.get("meta_result");
    if (!sid) return;
    // Clean the URL so a refresh does not re-run the flow.
    window.history.replaceState({}, "", window.location.pathname);
    if (result !== "ok") {
      setError("Facebook could not complete the connection. Please try again, or use Manual Connect.");
      return;
    }
    setSessionId(sid);
    void loadChoices(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadChoices(sid: string) {
    setBusy(true);
    setError(null);
    try {
      if (channel === "messenger") {
        const r: any = await loadPages({ data: { session_id: sid } });
        setPages(r.pages ?? []);
      } else {
        const r: any = await loadNumbers({ data: { session_id: sid } });
        setNumbers(r.numbers ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      const r: any = await start({ data: { channel } });
      window.location.href = r.authorize_url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function onPickPage(p: PageRow) {
    if (!sessionId) return;
    setBusy(true);
    try {
      await finishPage({ data: { session_id: sessionId, page_id: p.id } });
      toast.success(`Connected ${p.name}`);
      setPages(null);
      setSessionId(null);
      onConnected?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPickNumber(n: NumberRow) {
    if (!sessionId) return;
    setBusy(true);
    try {
      await finishNumber({
        data: { session_id: sessionId, phone_number_id: n.phone_number_id, waba_id: n.waba_id },
      });
      toast.success(`Connected ${n.display_phone_number}`);
      setNumbers(null);
      setSessionId(null);
      onConnected?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = channel === "messenger" ? "Auto Connect with Facebook" : "Auto Connect with WhatsApp";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Auto Connect (recommended)</div>
      </div>
      <p className="text-xs text-muted-foreground">
        {channel === "messenger"
          ? "Sign in with Facebook, pick your Page, and everything is set up for you — no IDs or tokens to copy."
          : "Sign in with Facebook, pick your WhatsApp business number, and everything is set up for you — no IDs or tokens to copy."}
      </p>

      {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

      {pages && (
        <div className="space-y-2">
          <div className="text-xs font-medium">Choose the Page to connect</div>
          {pages.length === 0 && (
            <div className="text-xs text-muted-foreground">
              No Facebook Pages were shared with this app. Re-run Auto Connect and tick your Page.
            </div>
          )}
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => onPickPage(p)}
              className="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted disabled:opacity-60"
            >
              {p.picture ? (
                <img src={p.picture} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {p.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.category ?? p.id}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {numbers && (
        <div className="space-y-2">
          <div className="text-xs font-medium">Choose the WhatsApp number to connect</div>
          {numbers.length === 0 && (
            <div className="text-xs text-muted-foreground">
              No WhatsApp business numbers were shared with this app. Re-run Auto Connect and tick your WhatsApp
              Business account.
            </div>
          )}
          {numbers.map((n) => (
            <button
              key={n.phone_number_id}
              type="button"
              disabled={busy}
              onClick={() => onPickNumber(n)}
              className="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{n.display_phone_number}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {n.verified_name ?? n.waba_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!pages && !numbers && (
        <Button type="button" onClick={onStart} disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          {label}
        </Button>
      )}
    </div>
  );
}
