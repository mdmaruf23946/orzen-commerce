import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { ACTIVE_STORE_HEADER, getActiveStoreId } from "@/lib/active-store";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Tells the server which store (own or delegated) the panel is working in.
// The server re-checks membership; an invalid value falls back to the own store.
const attachActiveStore = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const id = getActiveStoreId();
  return next({ headers: id ? { [ACTIVE_STORE_HEADER]: id } : {} });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, attachActiveStore],
  requestMiddleware: [errorMiddleware],
}));
