import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { outboundUrlProblem } from "./outbound-url";
import { assertSafeOutboundUrl } from "@/lib/integrations/external-sites";

describe("outbound webhook SSRF guard", () => {
  it("allows a public https URL", () => {
    expect(outboundUrlProblem("https://example.com/hook")).toBeNull();
  });
  it.each([
    "http://example.com", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x",
    "https://169.254.169.254/latest", "https://192.168.1.1/x", "https://[::1]/x",
    "https://metadata.google.internal/x", "https://2130706433/x", "https://example.com:8443/x",
    "https://user:pw@example.com/x",
  ])("blocks %s", (u) => {
    expect(outboundUrlProblem(u)).not.toBeNull();
  });
  it("external site links reject private and non-standard-port hosts", () => {
    expect(() => assertSafeOutboundUrl("https://100.64.0.1/x")).toThrow();
    expect(() => assertSafeOutboundUrl("https://shop.example.com:8080/x")).toThrow();
    expect(assertSafeOutboundUrl("https://shop.example.com/x")).toBe("https://shop.example.com/x");
  });
  it.each([
    "src/lib/admin/owner-ext.functions.ts",
    "src/lib/calls/orzen-call.functions.ts",
    "src/lib/integrations/external-sites.server.ts",
  ])("%s refuses to follow redirects", (f) => {
    const src = readFileSync(f, "utf8");
    expect(src).toContain('redirect: "error"');
    expect(src).not.toContain('redirect: "manual"');
  });
});
