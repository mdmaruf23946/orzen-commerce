// SAFETY: `supabase/migrations/` is the single source of truth for the schema.
// This config exists only for the platform migration tool; never run
// `drizzle-kit generate|push|pull|migrate` by hand, and never put credentials here.
// Guard: without the platform-provided migration URL this config refuses to load,
// so a manual drizzle-kit run stops before touching any database or file.
// See docs/DATABASE_MIGRATION_POLICY.md.
import { defineConfig } from "drizzle-kit";

const platformUrl = process.env.LOVABLE_DB_MIGRATION_URL;
if (!platformUrl) {
  throw new Error(
    "Drizzle is disabled for manual use. Schema changes go only in supabase/migrations/ " +
      "(see docs/DATABASE_MIGRATION_POLICY.md).",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url: platformUrl },
});
