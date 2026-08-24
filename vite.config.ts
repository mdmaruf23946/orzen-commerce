// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Nitro build preset. The build emits `dist/client` + `dist/server/index.mjs`;
// `scripts/pages-postbuild.sh` then reshapes that into the Cloudflare Pages
// layout (`dist/_worker.js` + static assets at the root) when running on the
// Pages build runner. Override with NITRO_PRESET if another target is needed.
process.env.NITRO_PRESET ||= "cloudflare_module";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // Allow tenant hostnames (subdomains + custom domains) to be tested in dev.
    server: { allowedHosts: true },
  },
});
