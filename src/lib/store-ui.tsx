import { createContext, useContext, useState, type ReactNode } from "react";

export type CategorySource = "header" | "icon" | null;

type Ctx = {
  query: string;
  setQuery: (v: string) => void;
  activeMainId: string | null;
  activeSubId: string | null;
  source: CategorySource;
  selectMain: (id: string | null, source: CategorySource) => void;
  selectSub: (id: string | null) => void;
};

const StoreUIContext = createContext<Ctx | null>(null);

export function StoreUIProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [activeMainId, setActiveMainId] = useState<string | null>(null);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [source, setSource] = useState<CategorySource>(null);

  const selectMain = (id: string | null, src: CategorySource) => {
    setActiveMainId(id);
    setActiveSubId(null);
    setSource(id ? src : null);
  };
  const selectSub = (id: string | null) => setActiveSubId(id);

  return (
    <StoreUIContext.Provider
      value={{ query, setQuery, activeMainId, activeSubId, source, selectMain, selectSub }}
    >
      {children}
    </StoreUIContext.Provider>
  );
}

export function useStoreUI(): Ctx {
  return (
    useContext(StoreUIContext) ?? {
      query: "",
      setQuery: () => {},
      activeMainId: null,
      activeSubId: null,
      source: null,
      selectMain: () => {},
      selectSub: () => {},
    }
  );
}
