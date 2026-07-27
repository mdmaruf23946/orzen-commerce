import { pendingAdapter, commonFields } from "./_pending";

export const paybybd = pendingAdapter({
  id: "paybybd",
  label: "PaybyBD",
  methods: ["bkash", "nagad", "rocket", "upay", "visa", "mastercard"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.storeId(),
    commonFields.apiKey(),
    commonFields.apiSecret(),
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
