import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess } from "@/lib/employees.functions";
import { allows, type PermissionMap } from "@/lib/panel-sections";

type StaffInfoLike = {
  id: string;
  name: string;
  role: string;
  employee_code: string | null;
  must_change_password: boolean;
};

export type AccessState = {
  loading: boolean;
  isOwner: boolean;
  isEmployee: boolean;
  staff: StaffInfoLike | null;
  permissions: PermissionMap | null;
  can: (section: string, level?: "view" | "manage") => boolean;
};

const Ctx = createContext<AccessState>({
  loading: true,
  isOwner: true,
  isEmployee: false,
  staff: null,
  permissions: null,
  can: () => true,
});

export function StoreAccessProvider({ children }: { children: ReactNode }) {
  const load = useServerFn(getMyAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["store", "access"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const isOwner = (data as any)?.isOwner ?? true;
  const isEmployee = (data as any)?.isEmployee ?? false;
  const permissions = ((data as any)?.permissions ?? null) as PermissionMap | null;

  const value: AccessState = {
    loading: isLoading,
    isOwner,
    isEmployee,
    staff: ((data as any)?.staff ?? null) as StaffInfoLike | null,
    permissions,
    can: (section, level = "view") => (isEmployee ? allows(permissions, section, level) : true),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoreAccess() {
  return useContext(Ctx);
}
