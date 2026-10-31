import { defineConfig } from "vitest/config";

// Keep unit tests outside the application's server-function RPC transforms.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node" },
});