import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { outboundUrlProblem } from "./outbound-url";
import { googleSheetCsvUrl, fetchGoogleSheet } from "./google-sheet-url";
import { executeRequest } from "@/lib/custom-gateway/engine.server";

const UNSAFE = [
  "http://example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://127.1/x",
  "https://0x7f000001/x", "https://10.1.2.3/x", "https://172.16.0.1/x", "https://192.168.0.1/x",
  "https://169.254.169.254/latest", "https://[::1]/x", "https://[fd00::1]/x", "https://[fe80::1]/x",
  "https://metadata.google.internal/x", "https://svc.internal/x", "https://example.com:8443/x",
  "https://u:p@example.com/x", "not a url",
];

afterEach(() => vi.unstubAllGlobals());

describe("Webhook URL validation (upsert + test)", () => {
  it("accepts public https and rejects unsafe URLs", () => {
    expect(outboundUrlProblem("https://hooks.example.com/in")).toBeNull();
    for (const u of UNSAFE) expect(outboundUrlProblem(u), u).not.toBeNull();
  });
  it("upsertWebhook validates before any insert/update (create and edit share one path)", () => {
    const src = readFileSync("src/lib/admin/owner-ext.functions.ts", "utf8");
    const body = src.slice(src.indexOf("export const upsertWebhook"), src.indexOf("export const deleteWebhook"));
    const check = body.indexOf("outboundUrlProblem(data.url)");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(body.indexOf(".update(rest)"));
    expect(check).toBeLessThan(body.indexOf(".insert(rest)"));
    const test = src.slice(src.indexOf("export const testWebhook"));
    expect(test).toContain("outboundUrlProblem(");
    expect(test).toContain('redirect: "error"');
  });
});

describe("Google Sheet CSV fetch", () => {
  it("builds the export URL for a valid sheet", () => {
    expect(googleSheetCsvUrl("https://docs.google.com/spreadsheets/d/abc_123-X/edit#gid=42"))
      .toBe("https://docs.google.com/spreadsheets/d/abc_123-X/export?format=csv&gid=42");
    expect(googleSheetCsvUrl("https://docs.google.com/spreadsheets/d/abc/edit"))
      .toBe("https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=0");
  });
  it.each([
    "https://evil.com/spreadsheets/d/abc", "https://docs.google.com.evil.com/spreadsheets/d/abc",
    "https://evilgoogle.com/spreadsheets/d/abc", "https://mail.google.com/spreadsheets/d/abc",
    "http://docs.google.com/spreadsheets/d/abc", "https://127.0.0.1/spreadsheets/d/abc",
    "https://localhost/spreadsheets/d/abc", "https://docs.google.com:8443/spreadsheets/d/abc",
    "https://evil.googleusercontent.com/spreadsheets/d/abc",
  ])("rejects %s", (u) => expect(googleSheetCsvUrl(u)).toBeNull());

  it("follows only allow-listed Google redirect hops", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: "https://doc-0s-sheets.googleusercontent.com/export/x" } }))
      .mockResolvedValueOnce(new Response("a,b\n1,2", { status: 200 }));
    const res = await fetchGoogleSheet("https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=0", f as any);
    expect(await res.text()).toBe("a,b\n1,2");
    expect(f.mock.calls[0][1].redirect).toBe("manual");
  });
  it.each(["https://169.254.169.254/latest", "https://evil.com/x", "http://doc.googleusercontent.com/x"])(
    "does not follow redirect to %s", async (loc) => {
      const f = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: loc } }));
      await expect(fetchGoogleSheet("https://docs.google.com/spreadsheets/d/abc/export?format=csv", f as any)).rejects.toThrow();
      expect(f).toHaveBeenCalledTimes(1);
    });
});

describe("Custom gateway executeRequest", () => {
  it.each(UNSAFE)("rejects %s before fetch", async (u) => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    await expect(executeRequest({ method: "POST", url: u, headers: {}, body: "{}" })).rejects.toThrow(/Gateway URL rejected/);
    expect(f).not.toHaveBeenCalled();
  });
  it("sends safe requests unchanged with redirect: error", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"ok":1}', { status: 200 })); vi.stubGlobal("fetch", f);
    const res = await executeRequest({ method: "POST", url: "https://api.pay.example.com/v1/checkout", headers: { "X-API-KEY": "k" }, body: "{}" });
    expect(res.status).toBe(200);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.pay.example.com/v1/checkout");
    expect(init).toMatchObject({ method: "POST", body: "{}", redirect: "error", headers: { "X-API-KEY": "k" } });
    await executeRequest({ method: "GET", url: "https://api.pay.example.com/v1/s", headers: {}, body: "x" });
    expect(f.mock.calls[1][1].body).toBeUndefined();
  });
});
