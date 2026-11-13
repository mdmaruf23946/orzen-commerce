import { describe, it, expect, vi } from "vitest";
import { safeRecordingFetch } from "./recording-fetch";

const ok = () => vi.fn(async () => new Response("audio", { status: 200 }));

describe("Stage C-2: recording fetch SSRF guard", () => {
  it("allows the ePBX provider host and blocks redirects", async () => {
    const f = ok();
    const res = await safeRecordingFetch("https://api.epbx.bd/calls/recordings/1", { headers: { A: "1" } }, f as any);
    expect(res?.status).toBe(200);
    expect(f).toHaveBeenCalledWith("https://api.epbx.bd/calls/recordings/1", { headers: { A: "1" }, redirect: "error" });
  });

  it("forces redirect:error even if caller asks to follow", async () => {
    const f = ok();
    await safeRecordingFetch("https://cdn.example.com/a.mp3", { redirect: "follow" }, f as any);
    expect((f.mock.calls[0] as any)[1].redirect).toBe("error");
  });

  it.each([
    "http://api.epbx.bd/rec.mp3",
    "https://localhost/rec.mp3",
    "https://127.0.0.1/rec.mp3",
    "https://10.0.0.5/rec.mp3",
    "https://192.168.1.1/rec.mp3",
    "https://172.16.0.1/rec.mp3",
    "https://169.254.169.254/latest/meta-data",
    "https://metadata.google.internal/x",
    "https://[::1]/rec.mp3",
    "https://2130706433/rec.mp3",
    "https://0x7f000001/rec.mp3",
    "https://user:pass@api.epbx.bd/rec.mp3",
    "https://api.epbx.bd:8443/rec.mp3",
    "not a url",
  ])("rejects %s without any network request", async (url) => {
    const f = ok();
    expect(await safeRecordingFetch(url, {}, f as any)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
