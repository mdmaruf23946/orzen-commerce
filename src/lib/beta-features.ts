// Features still in testing: visible only to the tester account(s).
// To release a feature to everyone, remove its entry from BETA_PATHS.
export const BETA_TESTER_EMAILS = ["mdmaruf0162323@gmail.com"];

export const BETA_PATHS = ["/admin/call-sms", "/admin/ai-call-center", "/admin/call-center"];

export function isBetaTester(email?: string | null): boolean {
  return !!email && BETA_TESTER_EMAILS.includes(email.trim().toLowerCase());
}

export function isBetaPath(path: string): boolean {
  return BETA_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}
