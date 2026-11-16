// Minimal Cloudflare R2 (S3-compatible) reader using SigV4 via Web Crypto — workerd-safe, no SDK.
// Objects mirror Supabase storage as "<bucket>/<path>". Any failure returns null so callers fall back.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

export async function r2Get(key: string): Promise<Blob | null> {
  const id = process.env.R2_ACCESS_KEY_ID, secret = process.env.R2_SECRET_ACCESS_KEY, acct = process.env.CF_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME || "orzen-media";
  if (!id || !secret || !acct) return null;
  try {
    const host = `${acct}.r2.cloudflarestorage.com`;
    const path = `/${bucket}/${key.split("/").map((s) => encodeURIComponent(s)).join("/")}`;
    const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = now.slice(0, 8);
    const payload = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const canon = `GET\n${path}\n\nhost:${host}\nx-amz-content-sha256:${payload}\nx-amz-date:${now}\n\nhost;x-amz-content-sha256;x-amz-date\n${payload}`;
    const scope = `${date}/auto/s3/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${now}\n${scope}\n${await sha(canon)}`;
    let k = await hmac(enc.encode("AWS4" + secret), date);
    for (const p of ["auto", "s3", "aws4_request"]) k = await hmac(k, p);
    const sig = hex(await hmac(k, sts));
    const res = await fetch(`https://${host}${path}`, {
      headers: {
        "x-amz-date": now,
        "x-amz-content-sha256": payload,
        Authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
      },
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
