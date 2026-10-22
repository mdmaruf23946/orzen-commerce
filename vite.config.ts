// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

process.env.NITRO_PRESET ||= "cloudflare_module";

// unenv's interop chunk calls createRequire(import.meta.url) at module scope;
// some Worker runtimes leave import.meta.url undefined, crashing every SSR
// request. Guard it in every build (preview + production).
async function guardRuntime(serverDir?: string) {
  if (!serverDir) return;
  const file = join(serverDir, "_runtime.mjs");
  try {
    const s = await readFile(file, "utf-8");
    const out = s.replace(
      /(\w+)\(import\.meta\.url\)/g,
      '$1(typeof import.meta.url!=="undefined"?import.meta.url:"file:///app/")',
    );
    if (out !== s) await writeFile(file, out, "utf-8");
  } catch {
    /* file absent — nothing to guard */
  }
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    hooks: {
      compiled: async (nitro: any) => {
        await guardRuntime(nitro?.options?.output?.serverDir);
      },
    },
  } as any,
  vite: {
    plugins: [
      mcpPlugin(),
      {
        name: "browser-events-shim",
        enforce: "pre",
        applyToEnvironment: (env: any) => env.name === "client",
        resolveId(id: string) {
          if (id === "events" || id === "node:events") return join(process.cwd(), "node_modules/events/events.js");
        },
      } as any,
    ],
    server: { allowedHosts: true },
    // JsSIP needs the real browser `events` package; the default Node shim is empty
    // and crashes with "Class extends value undefined".
  },
});
