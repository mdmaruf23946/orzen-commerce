// Nagad Merchant direct integration. Nagad requires RSA-signed requests,
// so key material is captured as PEM textareas — never stored client-side.
import { pendingAdapter, commonFields } from "./_pending";

export const nagadMerchant = pendingAdapter({
  id: "nagad_merchant",
  label: "Nagad Merchant",
  methods: ["nagad"],
  supportsSandbox: true,
  credentialFields: [
    commonFields.merchantId(),
    { key: "merchant_number", label: "Merchant Number", type: "text", group: "Credentials" },
    { key: "merchant_private_key", label: "Merchant Private Key (PEM)", type: "textarea", required: true, group: "Keys", helper: "PEM-encoded RSA private key from your Nagad merchant onboarding pack." },
    { key: "merchant_public_key", label: "Merchant Public Key (PEM)", type: "textarea", group: "Keys" },
    { key: "nagad_public_key", label: "Nagad Gateway Public Key (PEM)", type: "textarea", required: true, group: "Keys" },
    { key: "base_url", label: "API Base URL", type: "url", group: "Environment" },
    commonFields.callbackUrl(),
    commonFields.webhookSecret(),
  ],
});
