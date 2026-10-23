import { useEffect, useState } from "react";
import { getConfigs, getHistory, getSettings } from "@/lib/call-providers";

export function useCallStore() {
  const snap = () => ({ configs: getConfigs(), history: getHistory(), settings: getSettings() });
  const [s, setS] = useState(() => ({ configs: {} as ReturnType<typeof getConfigs>, history: [] as ReturnType<typeof getHistory>, settings: getSettings() }));
  useEffect(() => {
    const up = () => setS(snap());
    up();
    window.addEventListener("orzen-call-store", up);
    window.addEventListener("storage", up);
    return () => { window.removeEventListener("orzen-call-store", up); window.removeEventListener("storage", up); };
  }, []);
  return s;
}
