import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyStoresTool from "./tools/list-my-stores";
import listProductsTool from "./tools/list-products";
import listRecentOrdersTool from "./tools/list-recent-orders";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud proxy.
// VITE_SUPABASE_PROJECT_ID is inlined at build time by Vite; the fallback keeps
// the issuer well-formed during the manifest-extract eval when it's unset.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "orzen-mcp",
  title: "ORZEN Commerce",
  version: "0.1.0",
  instructions:
    "Tools for ORZEN store owners. Each call acts as the signed-in user, respecting store ownership and RLS. Use `list_my_stores` to discover the caller's stores, then `list_products` or `list_recent_orders` with a store id or slug.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyStoresTool, listProductsTool, listRecentOrdersTool],
});
