import { describe, it, expect, vi } from "vitest";
import { safeFetch, UnsafeUrlError, isSensitiveHeader } from "./safe-fetch";

const redirect = (status: number, location: string) => new Response(null, { status, headers: { location } });

describe("Stage C-4 cross-origin redirect credential protection", () => {
  it("blocks cross-origin redirect with Authorization", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(302, "https://evil.example.net/x"));
    await expect(safeFetch("https://api.courier.com/a", { headers: { Authorization: "Bearer s" } }, { fetchImpl: f as any })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("blocks cross-origin redirect with Api-Key / Secret-Key", async () => {
    for (const h of ["Api-Key", "Secret-Key", "X-API-Key", "X-Auth-Token", "Cookie"]) {
      const f = vi.fn().mockResolvedValueOnce(redirect(307, "https://other.example.org/"));
      await expect(safeFetch("https://api.courier.com/a", { headers: { [h]: "v" } }, { fetchImpl: f as any })).rejects.toThrow(/credentials/);
    }
  });
  it("blocks cross-origin 307 carrying a body (client_secret)", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(307, "https://other.example.org/"));
    await expect(safeFetch("https://api.courier.com/token", { method: "POST", body: JSON.stringify({ client_secret: "x" }) }, { fetchImpl: f as any })).rejects.toThrow(/body/);
  });
  it("drops body and switches to GET on 303 cross-origin", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(303, "https://cdn.example.org/r")).mockResolvedValueOnce(new Response("ok"));
    const r = await safeFetch("https://api.example.com/p", { method: "POST", body: "a=1" }, { fetchImpl: f as any });
    expect(r.status).toBe(200);
    expect(f.mock.calls[1][1].method).toBe("GET");
    expect(f.mock.calls[1][1].body).toBeNull();
  });
  it("allows same-origin redirect with credentials and keeps them", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(308, "/v2/a")).mockResolvedValueOnce(new Response("ok"));
    await safeFetch("https://api.courier.com/a", { method: "POST", body: "x", headers: { Authorization: "Bearer s" } }, { fetchImpl: f as any });
    expect(f.mock.calls[1][0]).toBe("https://api.courier.com/v2/a");
    expect(new Headers(f.mock.calls[1][1].headers).get("authorization")).toBe("Bearer s");
    expect(f.mock.calls[1][1].body).toBe("x");
  });
  it("allows public cross-origin redirect without credentials", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(302, "https://cdn.example.org/img.jpg")).mockResolvedValueOnce(new Response("img"));
    const r = await safeFetch("https://images.example.com/a.jpg", { headers: { Accept: "image/*" } }, { fetchImpl: f as any });
    expect(await r.text()).toBe("img");
  });
  it("still blocks private redirect targets", async () => {
    const f = vi.fn().mockResolvedValueOnce(redirect(302, "https://127.0.0.1/"));
    await expect(safeFetch("https://images.example.com/a", {}, { fetchImpl: f as any })).rejects.toThrow(/Blocked URL/);
  });
  it("classifies headers", () => {
    expect(isSensitiveHeader("accept")).toBe(false);
    expect(isSensitiveHeader("content-type")).toBe(false);
    expect(isSensitiveHeader("Proxy-Authorization")).toBe(true);
  });
});
