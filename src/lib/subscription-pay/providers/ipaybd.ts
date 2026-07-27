import { pendingAdapter, commonFields } from "./_pending";

export const ipaybd = pendingAdapter({
  id: "ipaybd",
  label: "iPayBD",
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
