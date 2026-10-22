/**
 * Spreadsheet-safe CSV helpers. Any text cell beginning with a formula
 * trigger (=, +, -, @, tab, CR) is prefixed with an apostrophe so Excel /
 * Sheets treat it as plain text instead of running it as a formula.
 */
export function neutralizeFormula(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Always-quoted, formula-neutralized CSV cell. */
export function csvCell(v: unknown): string {
  return `"${neutralizeFormula(v).replace(/"/g, '""')}"`;
}
