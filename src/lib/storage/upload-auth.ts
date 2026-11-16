// Pure rules for which store-assets paths an R2 upload may write.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSafeAssetPath(path: string): boolean {
  if (!path || path.length > 300) return false;
  const parts = path.split("/");
  if (parts.length < 2) return false;
  return parts.every((p) => p.length > 0 && p !== "." && p !== ".." && /^[A-Za-z0-9._-]+$/.test(p));
}

/** First folder: a store id (store team) — anything else is platform-level (owner role only). */
export function assetFolderStoreId(path: string): string | null {
  const first = path.split("/")[0];
  return UUID.test(first) ? first : null;
}
