// SSLCommerz adapter for ORZEN subscription payments.
// Uses the hosted Session API and Validator API. Cards + MFS (bKash, Nagad, Rocket) etc.
import type { SubscriptionPaymentProvider } from "./types";

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

function base(sandbox: boolean) {
  return sandbox ? SANDBOX_BASE : LIVE_BASE;
}

export const sslcommerz: SubscriptionPaymentProvider = {
  meta: {
    id: "sslcommerz",
    label: "SSLCommerz",
    methods: ["bkash", "nagad", "rocket", "visa", "mastercard", "amex", "bank", "internet_banking"],
    supportsSandbox: true,
    credentialFields: [
      { key: "store_id", label: "Store ID", type: "text", placeholder: "yourstore", required: true, group: "Credentials" },
      { key: "store_passwd", label: "Store Password / API Key", type: "password", required: true, group: "Credentials" },
      { key: "currency", label: "Currency", type: "select", group: "Credentials",
        options: [
          { label: "BDT — Bangladeshi Taka", value: "BDT" },
          { label: "USD — US Dollar", value: "USD" },
          { label: "EUR — Euro", value: "EUR" },
          { label: "GBP — British Pound", value: "GBP" },
        ], placeholder: "BDT" },
      { key: "success_url", label: "Success URL", type: "url", group: "Callback URLs", helper: "Leave blank to use the ORZEN default." },
      { key: "fail_url", label: "Fail URL", type: "url", group: "Callback URLs" },
      { key: "cancel_url", label: "Cancel URL", type: "url", group: "Callback URLs" },
      { key: "ipn_url", label: "IPN / Webhook URL", type: "url", group: "Callback URLs", helper: "Paste this into your SSLCommerz dashboard." },
    ],
  },
  async testConnection(cfg) {
    const start = Date.now();
    const storeId = String(cfg.credentials.store_id ?? "").trim();
    const storePasswd = String(cfg.credentials.store_passwd ?? "").trim();
    if (!storeId || !storePasswd) {
      return { ok: false, message: "Store ID and password are required", latency_ms: Date.now() - start };
    }
    try {
      const body = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePasswd,
        total_amount: "10",
        currency: String(cfg.credentials.currency ?? "BDT") || "BDT",
        tran_id: `test_${Date.now()}`,
        success_url: "https://example.com/s",
        fail_url: "https://example.com/f",
        cancel_url: "https://example.com/c",
        cus_name: "Test",
        cus_email: "test@example.com",
        cus_phone: "01700000000",
        cus_add1: "Dhaka",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
        shipping_method: "NO",
        product_name: "Test",
        product_category: "Subscription",
        product_profile: "general",
      });
      const res = await fetch(`${base(cfg.sandbox)}/gwprocess/v4/api.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json: any = await res.json();
      const latency = Date.now() - start;
      if (json?.status === "SUCCESS") {
        return { ok: true, message: `Connected (${cfg.sandbox ? "sandbox" : "live"})`, latency_ms: latency };
      }
      return { ok: false, message: json?.failedreason ?? "SSLCommerz rejected the credentials", latency_ms: latency };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Network error", latency_ms: Date.now() - start };
    }
  },
  async createCheckout(cfg, ctx) {
    const storeId = String(cfg.credentials.store_id ?? "").trim();
    const storePasswd = String(cfg.credentials.store_passwd ?? "").trim();
    const body = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePasswd,
      total_amount: ctx.amount.toFixed(2),
      currency: ctx.currency,
      tran_id: ctx.invoiceNo,
      success_url: String(cfg.credentials.success_url ?? "").trim() || ctx.returnUrl,
      fail_url: String(cfg.credentials.fail_url ?? "").trim() || ctx.cancelUrl,
      cancel_url: String(cfg.credentials.cancel_url ?? "").trim() || ctx.cancelUrl,
      ipn_url: String(cfg.credentials.ipn_url ?? "").trim() || ctx.webhookUrl,
      cus_name: ctx.customerName || "Customer",
      cus_email: ctx.customerEmail,
      cus_phone: ctx.customerPhone || "01700000000",
      cus_add1: "N/A",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      product_name: ctx.packageLabel,
      product_category: "Subscription",
      product_profile: "non-physical-goods",
    });
    const res = await fetch(`${base(cfg.sandbox)}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json: any = await res.json();
    if (json?.status !== "SUCCESS" || !json?.GatewayPageURL) {
      throw new Error(json?.failedreason ?? "SSLCommerz session failed");
    }
    return {
      redirect_url: json.GatewayPageURL as string,
      provider_ref: (json.sessionkey as string) ?? ctx.invoiceNo,
      raw: json,
    };
  },
  async verifyPayment(cfg, input) {
    const storeId = String(cfg.credentials.store_id ?? "").trim();
    const storePasswd = String(cfg.credentials.store_passwd ?? "").trim();
    const valId = String((input.raw as any)?.val_id ?? "").trim();
    if (!valId) {
      return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
    }
    const url = `${base(cfg.sandbox)}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePasswd)}&v=1&format=json`;
    const res = await fetch(url);
    const json: any = await res.json();
    const ok = json?.status === "VALID" || json?.status === "VALIDATED";
    return {
      status: ok ? "paid" : "failed",
      amount: Number(json?.amount ?? 0),
      currency: json?.currency ?? "BDT",
      method: json?.card_type ?? json?.card_issuer ?? undefined,
      provider_ref: json?.tran_id ?? input.provider_ref,
      raw: json,
    };
  },
  async parseWebhook(_cfg, req) {
    const contentType = req.headers.get("content-type") ?? "";
    let payload: any = {};
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      form.forEach((v, k) => (payload[k] = v));
    }
    return { provider_ref: payload.tran_id ?? "", raw: payload };
  },
};
