// Client-side customer session management (localStorage, scoped per store).
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCurrentCustomer,
  logoutCustomer,
} from "@/lib/customer-auth.functions";
import { claimGuestActivity } from "@/lib/customer-account.functions";

/** Guest chat keys + guest order proofs saved in this browser. */
function collectGuestProofs() {
  const chatKeys: string[] = [];
  const orders: { orderId: string; contact: string }[] = [];
  const uuid = /^[0-9a-f-]{36}$/i;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i) ?? "";
    const v = window.localStorage.getItem(k) ?? "";
    if (k.startsWith("orzen_ai_key:") && v.length >= 16) chatKeys.push(v);
    const m = k.match(/^orzen_(?:order_contact|n)__(.+)$/);
    if (m && uuid.test(m[1]) && v.trim().length >= 3 && !orders.some((o) => o.orderId === m[1]))
      orders.push({ orderId: m[1], contact: v.trim() });
  }
  return { chatKeys: chatKeys.slice(0, 30), orders: orders.slice(-100) };
}

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
  const claimFn = useServerFn(claimGuestActivity);

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
      try {
        const flag = `orzen_claimed__${slug}__${token.slice(0, 12)}`;
        const proofs = collectGuestProofs();
        const sig = String(proofs.chatKeys.length + ":" + proofs.orders.length);
        if ((proofs.chatKeys.length || proofs.orders.length) && window.sessionStorage.getItem(flag) !== sig) {
          const r = await claimFn({ data: { storeSlug: slug, token, ...proofs } });
          window.sessionStorage.setItem(flag, sig);
          if (r.chats || r.orders) qc.invalidateQueries();
        }
      } catch {
        /* linking is best-effort */
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
    isLoading: !ready || query.isLoading,
    setSession,
    signOut,
    refresh: () => qc.invalidateQueries({ queryKey: ["customer-session", slug] }),
  };
}

