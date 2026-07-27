import { pendingAdapter, commonFields } from "./_pending";

export const urbdpay = pendingAdapter({
  id: "urbdpay",
  label: "UrbdPay",
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
