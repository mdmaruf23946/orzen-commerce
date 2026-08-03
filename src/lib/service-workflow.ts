// Shared (browser-safe) constants for the Service order workflow.
// Service orders never use courier / shipping stages — this is their own flow.

export const SERVICE_STAGES = [
  "request_submitted",
  "pending_review",
  "confirmed",
  "consultation_scheduled",
  "in_progress",
  "waiting_for_client",
  "revision",
  "completed",
  "closed",
] as const;

export type ServiceStage = (typeof SERVICE_STAGES)[number];

export const SERVICE_STAGE_LABEL: Record<ServiceStage, string> = {
  request_submitted: "Request Submitted",
  pending_review: "Pending Review",
  confirmed: "Confirmed",
  consultation_scheduled: "Consultation Scheduled",
  in_progress: "In Progress",
  waiting_for_client: "Waiting for Client",
  revision: "Revision",
  completed: "Completed",
  closed: "Closed",
};

export const DEFAULT_ENABLED_STAGES: ServiceStage[] = [
  "request_submitted",
  "pending_review",
  "confirmed",
  "in_progress",
  "completed",
  "closed",
];

export const OPTIONAL_STAGES: ServiceStage[] = [
  "consultation_scheduled",
  "waiting_for_client",
  "revision",
];

export const MEETING_PLATFORMS = [
  { id: "google_meet", label: "Google Meet" },
  { id: "zoom", label: "Zoom" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "office", label: "Office Address" },
  { id: "phone", label: "Phone Call" },
] as const;

export const DELIVERABLE_KINDS = [
  { id: "file", label: "File" },
  { id: "source", label: "Source Files" },
  { id: "zip", label: "ZIP Package" },
  { id: "license", label: "License" },
  { id: "warranty", label: "Warranty" },
  { id: "credential", label: "Access Credentials" },
  { id: "key", label: "Activation / Product Key" },
] as const;

export const ASSIGNEE_ROLES = [
  { id: "staff", label: "Assigned Staff" },
  { id: "freelancer", label: "Assigned Freelancer" },
  { id: "agent", label: "Assigned Agent" },
] as const;

export type ServiceWorkflowSettings = {
  store_id: string;
  enabled_stages: ServiceStage[];
  default_revisions: number;
  allow_cancel: boolean;
  cancel_window_hours: number;
  response_time: string | null;
  support_channels: Record<string, boolean>;
  support_whatsapp: string | null;
  support_messenger: string | null;
  support_email: string | null;
  support_phone: string | null;
  allow_reviews: boolean;
};

export const DEFAULT_WORKFLOW: Omit<ServiceWorkflowSettings, "store_id"> = {
  enabled_stages: DEFAULT_ENABLED_STAGES,
  default_revisions: 0,
  allow_cancel: true,
  cancel_window_hours: 24,
  response_time: null,
  support_channels: { whatsapp: true, messenger: false, email: true, phone: true, live_chat: false },
  support_whatsapp: null,
  support_messenger: null,
  support_email: null,
  support_phone: null,
  allow_reviews: true,
};

/** Ordered, enabled-only stage list for a store. */
export function stageFlow(enabled: string[] | null | undefined): ServiceStage[] {
  const set = new Set((enabled?.length ? enabled : DEFAULT_ENABLED_STAGES) as string[]);
  set.add("request_submitted");
  return SERVICE_STAGES.filter((s) => set.has(s));
}

export function normalizeWorkflow(storeId: string, row: any): ServiceWorkflowSettings {
  const r = row ?? {};
  return {
    store_id: storeId,
    enabled_stages: stageFlow(r.enabled_stages),
    default_revisions: Number(r.default_revisions ?? 0),
    allow_cancel: r.allow_cancel ?? true,
    cancel_window_hours: Number(r.cancel_window_hours ?? 24),
    response_time: r.response_time ?? null,
    support_channels: { ...DEFAULT_WORKFLOW.support_channels, ...(r.support_channels ?? {}) },
    support_whatsapp: r.support_whatsapp ?? null,
    support_messenger: r.support_messenger ?? null,
    support_email: r.support_email ?? null,
    support_phone: r.support_phone ?? null,
    allow_reviews: r.allow_reviews ?? true,
  };
}
