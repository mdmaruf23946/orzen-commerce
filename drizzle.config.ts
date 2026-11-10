// SAFETY: `supabase/migrations/` is the single source of truth for the schema.
// This config exists only for the platform migration tool; never run
// `drizzle-kit generate|push|pull|migrate` by hand, and never put credentials here.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
