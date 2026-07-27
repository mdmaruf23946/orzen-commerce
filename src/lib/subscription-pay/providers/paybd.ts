import { pendingAdapter, commonFields } from "./_pending";

export const paybd = pendingAdapter({
  id: "paybd",
  label: "PayBD",
  methods: ["bkash", "nagad", "rocket", "visa", "mastercard"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.merchantId(),
    commonFields.apiKey(),
    commonFields.apiSecret(),
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
