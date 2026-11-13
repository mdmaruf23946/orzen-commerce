// SSRF-safe Google Sheets CSV import. Only docs.google.com is accepted as
// input. Google answers the export URL with a redirect to
// *.googleusercontent.com, so redirects are handled manually: each hop must
// pass outboundUrlProblem() AND be an exact allow-listed Google host.
import { outboundUrlProblem } from "./outbound-url";

const INPUT_HOST = "docs.google.com";
const MAX_HOPS = 3;

function isAllowedHop(host: string): boolean {
  const h = host.toLowerCase();
  return h === INPUT_HOST || /^[a-z0-9-]+\.googleusercontent\.com$/.test(h);
}

/** Returns the canonical CSV export URL, or null if the input is not a safe Google Sheet URL. */
export function googleSheetCsvUrl(raw: string): string | null {
  if (outboundUrlProblem(raw)) return null;
  const u = new URL(raw);
  if (u.hostname.toLowerCase() !== INPUT_HOST) return null;
  const m = u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const gidMatch = raw.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

export async function fetchGoogleSheet(csvUrl: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  let url = csvUrl;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (outboundUrlProblem(url) || !isAllowedHop(new URL(url).hostname)) {
      throw new Error("Sheet URL is not allowed");
    }
    const res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get("location");
    if (!loc) throw new Error("Sheet could not be downloaded");
    url = new URL(loc, url).toString();
  }
  throw new Error("Too many redirects while downloading the sheet");
}
