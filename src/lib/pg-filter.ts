/** Strip characters that carry meaning inside PostgREST `.or()` / ilike filters. */
export function pgSafe(v: unknown): string {
  return String(v ?? "").replace(/[,()%_*\\"':.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
