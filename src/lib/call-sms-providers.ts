// Registry of connected Call & SMS providers. Each entry gets its own menu
// item and its own isolated page; provider features never mix.
// SMS = standard mobile-number SMS only (not Messenger/WhatsApp/chat).
export type CallSmsProvider = {
  id: string;
  name: string;
  kind: "call" | "sms" | "call_sms";
  path: string;
};

export const CALL_SMS_PROVIDERS: CallSmsProvider[] = [
  { id: "epbx", name: "ePBX", kind: "call", path: "/admin/call-sms/epbx" },
];
