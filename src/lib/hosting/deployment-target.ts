export const PRODUCTION_SUPABASE_PROJECT_ID = "rljisleyqluoexmtncos";
export const DEVELOPMENT_SUPABASE_PROJECT_ID = "dqhfxvhzagitytpvildw";

export function supabaseProjectIdFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const suffix = ".supabase.co";
    return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
  } catch {
    return null;
  }
}

export function browserSupabaseProjectId(): string | null {
  return (
    import.meta.env.VITE_SUPABASE_PROJECT_ID ||
    supabaseProjectIdFromUrl(import.meta.env.VITE_SUPABASE_URL)
  );
}

export function isInvalidAuthSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unauthorized:\s*(invalid token|no token|no authorization|only bearer|no user id)|different deployment|session not found|jwt expired/i.test(
    message,
  );
}
