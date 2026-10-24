/** Remove filter delimiters/wildcards while preserving email and identifier punctuation.
 * Dots and colons inside a value do not introduce another PostgREST condition.
 * Keep underscores unchanged: this helper also serves exact `.eq` filters.
 */
export function pgSafe(v: unknown): string {
  return String(v ?? "").replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
