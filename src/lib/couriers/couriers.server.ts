// Server-only courier API adapters. Each probe follows the courier's
// official authentication scheme so "Test connection" reflects real access.

export type CourierCreds = Record<string, string>;

export type ProbeResult = {
  ok: boolean;
  message: string;
  snippet?: string;
};

function trimUrl(u: string) {
  return u.replace(/\/+$/, "");
}

async function req(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = (await res.text().catch(() => "")).slice(0, 800);
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function pickError(text: string, fallback: string) {
  try {
    const j = JSON.parse(text);
    return (
      j?.message ||
      j?.error ||
      j?.errors?.[0]?.message ||
      (typeof j?.errors === "string" ? j.errors : null) ||
      fallback
    );
  } catch {
    return fallback;
  }
}

/** Pathao: OAuth2 issue-token. Returns the access token when successful. */
export async function pathaoToken(base: string, c: CourierCreds) {
  const { status, text } = await req(`${trimUrl(base)}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: c.client_id,
      client_secret: c.client_secret,
      username: c.username,
      password: c.password,
      grant_type: "password",
    }),
  });
  if (status >= 200 && status < 300) {
    const token = (() => {
      try {
        return JSON.parse(text)?.access_token as string | undefined;
      } catch {
        return undefined;
      }
    })();
    if (token) return { ok: true as const, token, snippet: "" };
    return { ok: false as const, message: "Token missing in Pathao response", snippet: text };
  }
  return {
    ok: false as const,
    message: pickError(text, `Pathao auth failed (HTTP ${status})`),
    snippet: text,
  };
}

export async function probeCourier(
  key: string,
  base: string,
  c: CourierCreds,
): Promise<ProbeResult> {
  const url = trimUrl(base);
  switch (key) {
    case "steadfast": {
      const { status, text } = await req(`${url}/get_balance`, {
        headers: {
          "Api-Key": c.api_key ?? "",
          "Secret-Key": c.secret ?? c.api_secret ?? "",
          Accept: "application/json",
        },
      });
      if (status >= 200 && status < 300) return { ok: true, message: "SteadFast credentials verified", snippet: text };
      if (status === 401 || status === 403)
        return { ok: false, message: "Invalid API Key or Secret Key", snippet: text };
      return { ok: false, message: pickError(text, `SteadFast error (HTTP ${status})`), snippet: text };
    }
    case "pathao": {
      const r = await pathaoToken(url, c);
      if (r.ok) return { ok: true, message: "Pathao credentials verified" };
      return { ok: false, message: r.message, snippet: r.snippet };
    }
    case "redx": {
      const { status, text } = await req(`${url}/areas`, {
        headers: { "API-ACCESS-TOKEN": `Bearer ${c.api_key ?? ""}`, Accept: "application/json" },
      });
      if (status >= 200 && status < 300) return { ok: true, message: "RedX token verified", snippet: text };
      if (status === 401 || status === 403)
        return { ok: false, message: "Invalid RedX API access token", snippet: text };
      return { ok: false, message: pickError(text, `RedX error (HTTP ${status})`), snippet: text };
    }
    case "paperfly": {
      const basic = Buffer.from(`${c.username ?? ""}:${c.password ?? ""}`).toString("base64");
      const { status, text } = await req(`${url}/OrderStatus/`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          paperflykey: c.api_key ?? "",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ReferenceNumber: "CONNECTION-TEST" }),
      });
      if (status === 401 || status === 403)
        return { ok: false, message: "Invalid Paperfly username, password or key", snippet: text };
      if (status < 500) return { ok: true, message: "Paperfly credentials accepted", snippet: text };
      return { ok: false, message: pickError(text, `Paperfly error (HTTP ${status})`), snippet: text };
    }
    default: {
      // Generic reachability ping for legacy couriers.
      const headers: Record<string, string> = { Accept: "application/json" };
      if (c.user_id) headers["USER-ID"] = c.user_id;
      if (c.api_key) {
        headers["API-KEY"] = c.api_key;
        headers["Api-Key"] = c.api_key;
        headers["Authorization"] = `Bearer ${c.api_key}`;
      }
      if (c.api_secret || c.secret) {
        headers["API-SECRET"] = c.api_secret ?? c.secret!;
        headers["Secret-Key"] = c.api_secret ?? c.secret!;
      }
      if (c.merchant_code) headers["X-Merchant-Code"] = c.merchant_code;
      if (c.username && c.password && !c.api_key) {
        headers["Authorization"] =
          "Basic " + Buffer.from(`${c.username}:${c.password}`).toString("base64");
      }
      const { status, text } = await req(url, { headers });
      if (status < 500) return { ok: true, message: `Reachable (HTTP ${status})`, snippet: text };
      return { ok: false, message: `Server error (HTTP ${status})`, snippet: text };
    }
  }
}

/** Sync location data for couriers that expose it (Pathao, RedX). */
export async function syncCourierData(
  key: string,
  base: string,
  c: CourierCreds,
): Promise<{ ok: boolean; message: string; summary?: string }> {
  const url = trimUrl(base);
  if (key === "pathao") {
    const t = await pathaoToken(url, c);
    if (!t.ok) return { ok: false, message: t.message };
    const [cities, stores] = await Promise.all([
      req(`${url}/aladdin/api/v1/city-list`, {
        headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json" },
      }),
      req(`${url}/aladdin/api/v1/stores`, {
        headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json" },
      }),
    ]);
    const count = (txt: string) => {
      try {
        const j = JSON.parse(txt);
        return Array.isArray(j?.data?.data) ? j.data.data.length : Array.isArray(j?.data) ? j.data.length : 0;
      } catch {
        return 0;
      }
    };
    return {
      ok: true,
      message: "Pathao information synced",
      summary: `${count(cities.text)} cities · ${count(stores.text)} stores`,
    };
  }
  if (key === "redx") {
    const { status, text } = await req(`${url}/areas`, {
      headers: { "API-ACCESS-TOKEN": `Bearer ${c.api_key ?? ""}`, Accept: "application/json" },
    });
    if (status < 200 || status >= 300)
      return { ok: false, message: pickError(text, `RedX sync failed (HTTP ${status})`) };
    let n = 0;
    try {
      const j = JSON.parse(text);
      n = Array.isArray(j?.areas) ? j.areas.length : Array.isArray(j?.data) ? j.data.length : 0;
    } catch {
      n = 0;
    }
    return { ok: true, message: "RedX areas synced", summary: `${n} areas` };
  }
  return { ok: false, message: "This courier does not support syncing" };
}
