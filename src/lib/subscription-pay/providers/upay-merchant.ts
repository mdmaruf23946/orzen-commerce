// Upay Merchant direct integration stub.
import { pendingAdapter, commonFields } from "./_pending";

export const upayMerchant = pendingAdapter({
  id: "upay_merchant",
  label: "Upay Merchant",
  methods: ["upay"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.merchantId(),
    commonFields.storeId(),
    commonFields.apiKey(),
    commonFields.clientId(),
    commonFields.clientSecret(),
    commonFields.username(),
    commonFields.password(),
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
