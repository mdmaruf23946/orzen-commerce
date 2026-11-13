import { describe, it, expect, vi } from "vitest";
import { safeFetch, UnsafeUrlError } from "./safe-fetch";

const ok = () => new Response("ok", { status: 200 });
const redir = (to: string) => new Response(null, { status: 302, headers: { location: to } });

describe("safeFetch (Stage C-3)", () => {
  for (const bad of ["http://example.com", "https://127.0.0.1/x", "https://169.254.169.254/latest", "https://localhost/", "https://10.0.0.5/", "https://[::1]/", "https://a.com:8443/"]) {
    it(`blocks ${bad}`, async () => {
      const f = vi.fn();
      await expect(safeFetch(bad, {}, { fetchImpl: f as any })).rejects.toBeInstanceOf(UnsafeUrlError);
      expect(f).not.toHaveBeenCalled();
    });
  }
  it("allows public https and never auto-follows", async () => {
    const f = vi.fn(async () => ok());
    const r = await safeFetch("https://api.example.com/x", {}, { fetchImpl: f as any });
    expect(r.status).toBe(200);
    expect((f.mock.calls[0] as any)[1].redirect).toBe("manual");
  });
  it("follows safe redirect hops (e.g. Messenger CDN)", async () => {
    const f = vi.fn().mockResolvedValueOnce(redir("https://cdn.example.com/img")).mockResolvedValueOnce(ok());
    const r = await safeFetch("https://lookaside.example.com/a", {}, { fetchImpl: f as any });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("blocks redirect to metadata IP", async () => {
    const f = vi.fn().mockResolvedValueOnce(redir("http://169.254.169.254/"));
    await expect(safeFetch("https://evil.example.com", {}, { fetchImpl: f as any })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("blocks redirect to private host even with allowHttp", async () => {
    const f = vi.fn().mockResolvedValueOnce(redir("http://192.168.1.1/"));
    await expect(safeFetch("http://shop.example.com/x", {}, { allowHttp: true, fetchImpl: f as any })).rejects.toBeInstanceOf(UnsafeUrlError);
  });
  it("allows http only with allowHttp for public host", async () => {
    const f = vi.fn(async () => ok());
    await expect(safeFetch("http://shop.example.com/x", {}, { allowHttp: true, fetchImpl: f as any })).resolves.toBeTruthy();
  });
  it("stops after too many redirects", async () => {
    const f = vi.fn(async () => redir("https://a.example.com/loop"));
    await expect(safeFetch("https://a.example.com/", {}, { fetchImpl: f as any })).rejects.toThrow(/Too many/);
  });
});
