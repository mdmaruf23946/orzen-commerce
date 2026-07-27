// bKash Merchant direct integration. Field set mirrors bKash's PGW /
// Tokenized Checkout onboarding pack. Live API calls are wired by
// Winner Admin once merchant credentials are provisioned.
import { pendingAdapter, commonFields } from "./_pending";

export const bkashMerchant = pendingAdapter({
  id: "bkash_merchant",
  label: "bKash Merchant",
  methods: ["bkash"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.appKey(),
    commonFields.appSecret(),
    commonFields.username(),
    commonFields.password(),
    { key: "merchant_number", label: "Merchant Number", type: "text", group: "Credentials", helper: "Your bKash merchant account (11 digits)." },
    { key: "base_url", label: "API Base URL", type: "url", group: "Environment", helper: "Leave blank to use bKash defaults." },
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
