import { pendingAdapter, commonFields } from "./_pending";

export const nagorikpay = pendingAdapter({
  id: "nagorikpay",
  label: "NagorikPay",
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
