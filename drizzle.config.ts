// SAFETY: `supabase/migrations/` is the single source of truth for the schema.
// This config exists only for the platform migration tool. Without the
// platform-provided LOVABLE_DB_MIGRATION_URL, every database-touching command
// (push, pull, migrate, studio, drop, up) and plain `generate` stop here before
// connecting or writing files. `check` and `generate --custom` (used by the
// platform workflow) stay allowed. See docs/DATABASE_MIGRATION_POLICY.md.
import { defineConfig } from "drizzle-kit";

const BLOCKED = new Set(["push", "pull", "introspect", "migrate", "studio", "drop", "up", "generate"]);

export function drizzleGuardProblem(argv: string[], url: string | undefined): string | null {
  if (url && url.trim()) return null;
  const cmd = argv.find((a) => BLOCKED.has(a) || a === "check");
  if (!cmd || cmd === "check") return null;
  if (cmd === "generate" && argv.includes("--custom")) return null;
  return (
    `Drizzle "${cmd}" is disabled for manual use. Schema changes go only in supabase/migrations/ ` +
    "(see docs/DATABASE_MIGRATION_POLICY.md)."
  );
}

const problem = drizzleGuardProblem(process.argv, process.env.LOVABLE_DB_MIGRATION_URL);
if (problem) throw new Error(problem);

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
