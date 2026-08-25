import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANDING_COPY, type CopyKey } from "./landing-copy";

export type Lang = "en" | "bn";

const STORAGE_KEY = "orzen-lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: CopyKey) => string;
  pick: (pair: { en: string; bn: string }) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Always start at "en" so server and first client render match.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "bn" || stored === "en") setLangState(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key) => {
        const pair = LANDING_COPY[key];
        if (!pair) return key;
        return lang === "bn" ? pair.bn : pair.en;
      },
      pick: (pair) => (lang === "bn" ? pair.bn : pair.en),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

const FALLBACK: Ctx = {
  lang: "en",
  setLang: () => {},
  t: (key) => LANDING_COPY[key]?.en ?? key,
  pick: (pair) => pair.en,
};

export function useLang(): Ctx {
  return useContext(LangContext) ?? FALLBACK;
}
