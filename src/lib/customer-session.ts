// Client-side customer session management (localStorage, scoped per store).
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCurrentCustomer,
  logoutCustomer,
} from "@/lib/customer-auth.functions";

export type StoreCustomer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export function tokenKey(slug: string) {
  return `orzen_customer_token__${slug}`;
}

export function readToken(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(tokenKey(slug));
  } catch {
    return null;
  }
}

export function writeToken(slug: string, token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(tokenKey(slug), token);
    else window.localStorage.removeItem(tokenKey(slug));
    window.dispatchEvent(new Event("customer-session-changed"));
  } catch {
    /* ignore */
  }
}

export function useCustomerSession(slug: string) {
  // Start null on both server and first client render so hydration matches;
  // the real token is read after mount.
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  const getCurrent = useServerFn(getCurrentCustomer);
  const logoutFn = useServerFn(logoutCustomer);

  useEffect(() => {
    const sync = () => {
      setToken(readToken(slug));
      setReady(true);
    };
    sync();
    window.addEventListener("customer-session-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("customer-session-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);



  const query = useQuery({
    queryKey: ["customer-session", slug, token],
    queryFn: async () => {
      if (!token) return null;
      const c = await getCurrent({ data: { storeSlug: slug, token } });
      if (!c) {
        writeToken(slug, null);
        return null;
      }
      return c as StoreCustomer;
    },
    staleTime: 60_000,
  });

  const setSession = useCallback(
    (t: string | null) => {
      writeToken(slug, t);
      setToken(t);
      qc.invalidateQueries({ queryKey: ["customer-session", slug] });
    },
    [slug, qc],
  );

  const signOut = useCallback(async () => {
    const t = readToken(slug);
    if (t) {
      try {
        await logoutFn({ data: { token: t } });
      } catch {
        /* ignore */
      }
    }
    setSession(null);
    qc.invalidateQueries();
  }, [slug, logoutFn, setSession, qc]);

  return {
    token,
    customer: query.data ?? null,
    isLoading: query.isLoading,
    setSession,
    signOut,
    refresh: () => qc.invalidateQueries({ queryKey: ["customer-session", slug] }),
  };
}
