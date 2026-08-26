import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORE_COPY, type CopyPair } from "./store-copy";

export type StoreLang = "en" | "bn";

type Ctx = {
  lang: StoreLang;
  setLang: (l: StoreLang) => void;
  /** Switcher visible to shoppers? Controlled by the merchant. */
  switcherEnabled: boolean;
  /** Translate a dictionary key, with optional {placeholder} values. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Translate an inline pair without touching the dictionary. */
  pick: (pair: CopyPair) => string;
};

const StoreLangContext = createContext<Ctx | null>(null);

function format(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function storageKey(storeId: string) {
  return `orzen-store-lang:${storeId}`;
}

export function StoreLangProvider({
  storeId,
  defaultLang = "en",
  switcherEnabled = true,
  children,
}: {
  storeId: string;
  defaultLang?: StoreLang | string | null;
  switcherEnabled?: boolean | null;
  children: ReactNode;
}) {
  const initial: StoreLang = defaultLang === "bn" ? "bn" : "en";
  const canSwitch = switcherEnabled !== false;
  // Server and first client render always agree on the merchant default.
  const [lang, setLangState] = useState<StoreLang>(initial);

  useEffect(() => {
    setLangState(initial);
    if (!canSwitch) return;
    try {
      const stored = window.localStorage.getItem(storageKey(storeId));
      if (stored === "bn" || stored === "en") setLangState(stored);
    } catch {
      /* storage unavailable */
    }
  }, [storeId, initial, canSwitch]);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (l: StoreLang) => {
      if (!canSwitch) return;
      setLangState(l);
      try {
        window.localStorage.setItem(storageKey(storeId), l);
      } catch {
        /* storage unavailable */
      }
    },
    [canSwitch, storeId],
  );

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      switcherEnabled: canSwitch,
      t: (key, vars) => {
        const pair = STORE_COPY[key];
        if (!pair) return format(key, vars);
        return format(lang === "bn" ? pair.bn : pair.en, vars);
      },
      pick: (pair) => (lang === "bn" ? pair.bn : pair.en),
    }),
    [lang, setLang, canSwitch],
  );

  return <StoreLangContext.Provider value={value}>{children}</StoreLangContext.Provider>;
}

const FALLBACK: Ctx = {
  lang: "en",
  setLang: () => {},
  switcherEnabled: false,
  t: (key, vars) => format(STORE_COPY[key]?.en ?? key, vars),
  pick: (pair) => pair.en,
};

export function useStoreT(): Ctx {
  return useContext(StoreLangContext) ?? FALLBACK;
}
