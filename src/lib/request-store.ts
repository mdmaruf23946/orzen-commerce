// Reads the panel's selected store from the current request (server only).
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { ACTIVE_STORE_HEADER, isUuid } from "@/lib/active-store";

export const requestedStoreId = createIsomorphicFn()
  .server((): string | null => {
    try {
      const v = getRequestHeader(ACTIVE_STORE_HEADER);
      return isUuid(v) ? v : null;
    } catch {
      return null;
    }
  })
  .client((): string | null => null);
