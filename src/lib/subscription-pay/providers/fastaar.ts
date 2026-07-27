import { pendingAdapter, commonFields } from "./_pending";

export const fastaar = pendingAdapter({
  id: "fastaar",
  label: "Fastaar",
  methods: ["bkash", "nagad", "rocket", "visa", "mastercard", "bank"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.merchantId(),
    commonFields.apiKey(),
    commonFields.apiSecret(),
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
