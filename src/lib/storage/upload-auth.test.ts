import { describe, it, expect } from "vitest";
import { assetFolderStoreId, isSafeAssetPath } from "./upload-auth";
describe("R2 upload path rules", () => {
  it("rejects path traversal", () => expect(isSafeAssetPath("abc/../x.jpg")).toBe(false));
  it("accepts store file path", () => expect(isSafeAssetPath("870d92cc-999f-4246-b0b7-2a879f12c2a3/1-a.jpg")).toBe(true));
  it("store folder maps to store id", () => expect(assetFolderStoreId("870d92cc-999f-4246-b0b7-2a879f12c2a3/x.jpg")).toBe("870d92cc-999f-4246-b0b7-2a879f12c2a3"));
  it("platform folder needs owner", () => expect(assetFolderStoreId("platform-showcase/x.jpg")).toBeNull());
});
