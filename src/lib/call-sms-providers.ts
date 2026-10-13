// Registry of Call & SMS providers. A provider gets its own sidebar menu ONLY
// while it is connected for the store; otherwise it shows only on the
// "Call & SMS Apps" hub with a Connect button. Provider features never mix.
// SMS = standard mobile-number SMS only (not Messenger/WhatsApp/chat).
import { Bot, Hash, Headset, History, LayoutDashboard, Mic, Plug, SlidersHorizontal, Workflow, type LucideIcon } from "lucide-react";

export type CallSmsProviderSection = { key: string; label: string; icon: LucideIcon };

export type CallSmsProvider = {
  id: string;
  name: string;
  kind: "call" | "sms" | "call_sms";
  path: string;
  description: string;
  /** Provider-specific workspace sections, from its capabilities. */
  sections: CallSmsProviderSection[];
  /** Section that holds the connect/setup form. */
  setupSection: string;
  /** Optional card tag (defaults to kind label). */
  tag?: string;
  /** Setup opens as a modal on the Apps hub instead of a page. */
  modal?: boolean;
};

export const CALL_SMS_HUB_PATH = "/admin/call-sms/apps";

export const CALL_SMS_PROVIDERS: CallSmsProvider[] = [
  {
    id: "epbx",
    name: "ePBX",
    kind: "call",
    path: "/admin/call-sms/epbx",
    description: "Voice calling: automatic order confirmation calls, customer calls, history & recordings.",
    setupSection: "integration",
    sections: [
      { key: "overview", icon: LayoutDashboard, label: "Overview" },
      { key: "integration", icon: Plug, label: "Integration" },
      { key: "numbers", icon: Hash, label: "Phone Numbers" },
      { key: "extensions", icon: Headset, label: "Extensions" },
      { key: "settings", icon: SlidersHorizontal, label: "Call Settings" },
      { key: "automation", icon: Bot, label: "AI Call Automation" },
      { key: "ivr", icon: Workflow, label: "IVR" },
      { key: "calls", icon: History, label: "Call History" },
      { key: "recordings", icon: Mic, label: "Recordings" },
    ],
  },
  {
    id: "orzen-call",
    name: "Orzen Call",
    kind: "call",
    tag: "Call / AI Voice",
    path: "/admin/call-sms/apps",
    description: "AI Voice Calling: Automatic COD order confirmation calls, live customer dialogue, product inquiry & order auto-sync.",
    setupSection: "setup",
    modal: true,
    sections: [{ key: "setup", icon: Plug, label: "Setup" }],
  },
];

/** Connection status per provider id, from the store's own connection rows. */
export type ProviderConnectionMap = Record<string, boolean>;
