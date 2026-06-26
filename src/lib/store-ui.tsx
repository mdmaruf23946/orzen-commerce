import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { query: string; setQuery: (v: string) => void };
const StoreUIContext = createContext<Ctx | null>(null);

export function StoreUIProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <StoreUIContext.Provider value={{ query, setQuery }}>{children}</StoreUIContext.Provider>;
}

export function useStoreUI(): Ctx {
  return useContext(StoreUIContext) ?? { query: "", setQuery: () => {} };
}
