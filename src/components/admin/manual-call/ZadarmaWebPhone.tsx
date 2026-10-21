import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getZadarmaWebPhone } from "@/lib/manual-call.functions";

const LIB = "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js";
const FN = "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js";

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = false;
    s.onload = () => res(); s.onerror = () => rej(new Error("Could not load Zadarma phone"));
    document.head.appendChild(s);
  });
}

export function ZadarmaWebPhone({ lines }: { lines: any[] }) {
  const getFn = useServerFn(getZadarmaWebPhone);
  const [lineId, setLineId] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => { if (!lineId && lines.length) setLineId((lines.find((l) => l.is_default) ?? lines[0]).id); }, [lines, lineId]);

  async function start() {
    setState("loading"); setError("");
    try {
      const r = await getFn({ data: { id: lineId, domain: window.location.hostname } });
      if (!r.ok) { setError(r.error); setState("error"); return; }
      await loadScript(LIB);
      await loadScript(FN);
      const w = window as any;
      if (typeof w.zadarmaWidgetFn !== "function") throw new Error("Zadarma phone did not start");
      w.zadarmaWidgetFn(r.key, r.sip, "rounded", "en", true, { right: "16px", bottom: "16px" });
      setState("ready");
    } catch (e: any) {
      setError(e?.message || "Something went wrong"); setState("error");
    }
  }

  if (!lines.length) return <p className="mt-2 text-sm text-muted-foreground">Add your Zadarma SIP line in Setup first.</p>;

  return (
    <div className="mt-2 space-y-3 rounded-xl border p-4">
      <p className="text-sm">Zadarma's own phone opens at the bottom-right of this page. Allow the microphone when the browser asks.</p>
      {lines.length > 1 && (
        <Select value={lineId} onValueChange={setLineId}>
          <SelectTrigger><SelectValue placeholder="Choose line" /></SelectTrigger>
          <SelectContent>{lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.label || l.sip_username}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Button onClick={start} disabled={state === "loading" || state === "ready"} className="w-full sm:w-auto">
        {state === "loading" ? "Opening…" : state === "ready" ? "Phone is open" : "Open Zadarma phone"}
      </Button>
      {state === "error" && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
