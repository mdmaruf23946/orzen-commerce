import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mySecurityStatus } from "@/lib/merchant-security.functions";

export type SecurityStatus = {
  email: string | null;
  emailVerified: boolean;
  verifiedAt: string | null;
  totpEnabled: boolean;
  backupCodesLeft: number;
};

/** Merchant account security status (email verification + 2FA). */
export function useSecurityStatus(enabled = true) {
  const fn = useServerFn(mySecurityStatus);
  return useQuery<SecurityStatus>({
    queryKey: ["admin", "security"],
    queryFn: () => fn() as Promise<SecurityStatus>,
    staleTime: 60_000,
    enabled,
    retry: false,
  });
}

export function useRefreshSecurity() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "security"] });
}

/** Panel areas that require a verified email address. */
export const SENSITIVE_PATHS = [
  "/admin/billing",
  "/admin/subscription",
  "/admin/settings/subscription",
  "/admin/domains",
  "/admin/payments",
  "/admin/finance",
  "/admin/couriers",
  "/admin/employees",
  "/admin/staff",
  "/admin/facebook",
  "/admin/whatsapp",
  "/admin/import-export",
];

export function isSensitivePath(path: string) {
  return SENSITIVE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
