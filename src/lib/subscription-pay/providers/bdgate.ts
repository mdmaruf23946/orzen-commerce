import { pendingAdapter, commonFields } from "./_pending";

export const bdgate = pendingAdapter({
  id: "bdgate",
  label: "BDGate",
  methods: ["bkash", "nagad", "rocket", "upay", "visa", "mastercard", "bank"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.merchantId(),
    commonFields.apiKey(),
    commonFields.apiSecret(),
    { key: "base_url", label: "API Base URL", type: "url", group: "Environment" },
    commonFields.successUrl(),
    commonFields.failUrl(),
    commonFields.cancelUrl(),
    commonFields.webhookSecret(),
  ],
});
