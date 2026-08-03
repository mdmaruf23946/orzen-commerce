// Store Admin → Order details drawer → Service workflow panel.
// Only rendered for order_type = "service". Nothing courier/shipping related here.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Workflow,
  CalendarClock,
  UserCog,
  Megaphone,
  FileDown,
  RefreshCcw,
  Star,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_STAGE_LABEL,
  MEETING_PLATFORMS,
  DELIVERABLE_KINDS,
  ASSIGNEE_ROLES,
  type ServiceStage,
} from "@/lib/service-workflow";
import {
  getServiceOrderAdmin,
  setServiceStage,
  publishServiceUpdate,
  saveServiceMeeting,
  assignServiceStaff,
  addServiceDeliverable,
  deleteServiceDeliverable,
  respondServiceRevision,
  grantServiceRevisions,
} from "@/lib/service-order-admin.functions";

function Block({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border bg-muted/20">
      <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </summary>
      <div className="space-y-2 border-t px-2.5 py-2.5">{children}</div>
    </details>
  );
}

async function fileToB64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export function ServiceWorkflowPanel({ orderId, open }: { orderId: string; open: boolean }) {
  const load = useServerFn(getServiceOrderAdmin);
  const stageFn = useServerFn(setServiceStage);
  const updateFn = useServerFn(publishServiceUpdate);
  const meetingFn = useServerFn(saveServiceMeeting);
  const assignFn = useServerFn(assignServiceStaff);
  const addDelivFn = useServerFn(addServiceDeliverable);
  const delDelivFn = useServerFn(deleteServiceDeliverable);
  const revisionFn = useServerFn(respondServiceRevision);
  const grantFn = useServerFn(grantServiceRevisions);
  const qc = useQueryClient();

  const key = ["service-order-admin", orderId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { orderId } }),
    enabled: open,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const [stageNote, setStageNote] = useState("");
  const [upd, setUpd] = useState({ status_label: "", note: "" });
  const [meeting, setMeeting] = useState({
    starts_at: "",
    duration_minutes: 30,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: "google_meet",
    meeting_link: "",
    office_address: "",
    passcode: "",
    notes: "",
  });
  const [assignee, setAssignee] = useState({
    name: "",
    role: "staff" as "staff" | "freelancer" | "agent",
    whatsapp: "",
    messenger: "",
    email: "",
    phone: "",
    response_time: "",
  });
  const [deliv, setDeliv] = useState({
    kind: "file",
    title: "",
    external_url: "",
    secret_value: "",
    expires_at: "",
    download_limit: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;
  if (isLoading || !data) {
    return <p className="text-xs text-muted-foreground">Loading service workflow…</p>;
  }

  const d: any = data;
  const stages: ServiceStage[] = d.settings.enabled_stages;
  const revisionsAllowed = Number(d.state?.revisions_allowed ?? d.settings.default_revisions ?? 0);

  async function run(name: string, fn: () => Promise<any>, msg: string) {
    setBusy(name);
    try {
      await fn();
      refresh();
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {/* Stage */}
      <Block icon={Workflow} title={`Stage · ${SERVICE_STAGE_LABEL[d.currentStage as ServiceStage] ?? d.currentStage}`}>
        <div className="flex flex-wrap gap-1">
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy === "stage"}
              onClick={() =>
                run("stage", () => stageFn({ data: { orderId, stage: s, note: stageNote || undefined } }), "Stage updated").then(
                  () => setStageNote(""),
                )
              }
              className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                d.currentStage === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {SERVICE_STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <Input
          value={stageNote}
          onChange={(e) => setStageNote(e.target.value)}
          placeholder="Optional note for this stage"
          className="h-8 text-xs"
        />
        <ol className="space-y-1">
          {d.progress.map((p: any) => (
            <li key={p.id} className="text-[11px]">
              <span className="font-medium">{SERVICE_STAGE_LABEL[p.stage as ServiceStage] ?? p.stage}</span>
              <span className="text-muted-foreground"> · {new Date(p.created_at).toLocaleString()}</span>
              {p.note && <div className="text-muted-foreground">{p.note}</div>}
            </li>
          ))}
          {d.progress.length === 0 && <li className="text-[11px] text-muted-foreground">No stage history yet.</li>}
        </ol>
      </Block>

      {/* Updates */}
      <Block icon={Megaphone} title={`Client updates (${d.updates.length})`}>
        <Input
          value={upd.status_label}
          onChange={(e) => setUpd((u) => ({ ...u, status_label: e.target.value }))}
          placeholder="Status label (e.g. Designer assigned)"
          className="h-8 text-xs"
        />
        <Textarea
          rows={2}
          value={upd.note}
          onChange={(e) => setUpd((u) => ({ ...u, note: e.target.value }))}
          placeholder="Note for the client…"
          className="text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={upd.status_label.trim().length < 2 || busy === "update"}
          onClick={() =>
            run("update", () => updateFn({ data: { orderId, status_label: upd.status_label.trim(), note: upd.note || undefined } }), "Update published").then(
              () => setUpd({ status_label: "", note: "" }),
            )
          }
        >
          Publish update
        </Button>
        <ul className="space-y-1">
          {d.updates.map((u: any) => (
            <li key={u.id} className="rounded bg-muted/40 p-2 text-[11px]">
              <div className="font-medium">{u.status_label}</div>
              {u.note && <div className="text-muted-foreground">{u.note}</div>}
              <div className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </Block>

      {/* Meeting */}
      <Block icon={CalendarClock} title={`Meetings (${d.meetings.length})`}>
        <ul className="space-y-1">
          {d.meetings.map((m: any) => (
            <li key={m.id} className="rounded bg-muted/40 p-2 text-[11px]">
              <div className="font-medium">{new Date(m.starts_at).toLocaleString()}</div>
              <div className="text-muted-foreground capitalize">
                {(m.platform ?? "").replace(/_/g, " ")} · {m.status ?? "scheduled"}
              </div>
              {m.meeting_link && <div className="truncate text-primary">{m.meeting_link}</div>}
            </li>
          ))}
        </ul>
        <Input
          type="datetime-local"
          value={meeting.starts_at}
          onChange={(e) => setMeeting((m) => ({ ...m, starts_at: e.target.value }))}
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={meeting.platform}
            onChange={(e) => setMeeting((m) => ({ ...m, platform: e.target.value }))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {MEETING_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={5}
            value={meeting.duration_minutes}
            onChange={(e) => setMeeting((m) => ({ ...m, duration_minutes: Number(e.target.value) }))}
            className="h-8 text-xs"
            placeholder="Minutes"
          />
        </div>
        {meeting.platform === "office" ? (
          <Input
            value={meeting.office_address}
            onChange={(e) => setMeeting((m) => ({ ...m, office_address: e.target.value }))}
            placeholder="Office address"
            className="h-8 text-xs"
          />
        ) : (
          <Input
            value={meeting.meeting_link}
            onChange={(e) => setMeeting((m) => ({ ...m, meeting_link: e.target.value }))}
            placeholder="Meeting link"
            className="h-8 text-xs"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={meeting.passcode}
            onChange={(e) => setMeeting((m) => ({ ...m, passcode: e.target.value }))}
            placeholder="Passcode"
            className="h-8 text-xs"
          />
          <Input
            value={meeting.timezone}
            onChange={(e) => setMeeting((m) => ({ ...m, timezone: e.target.value }))}
            placeholder="Time zone"
            className="h-8 text-xs"
          />
        </div>
        <Textarea
          rows={2}
          value={meeting.notes}
          onChange={(e) => setMeeting((m) => ({ ...m, notes: e.target.value }))}
          placeholder="Meeting notes"
          className="text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!meeting.starts_at || busy === "meeting"}
          onClick={() =>
            run(
              "meeting",
              () =>
                meetingFn({
                  data: {
                    orderId,
                    starts_at: new Date(meeting.starts_at).toISOString(),
                    duration_minutes: meeting.duration_minutes,
                    timezone: meeting.timezone || null,
                    platform: meeting.platform,
                    meeting_link: meeting.meeting_link || null,
                    office_address: meeting.office_address || null,
                    passcode: meeting.passcode || null,
                    notes: meeting.notes || null,
                  },
                }),
              "Meeting scheduled",
            )
          }
        >
          Schedule meeting
        </Button>
      </Block>

      {/* Assignment */}
      <Block icon={UserCog} title={d.assignment ? `Assigned · ${d.assignment.name}` : "Assign staff"}>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={assignee.name}
            onChange={(e) => setAssignee((a) => ({ ...a, name: e.target.value }))}
            placeholder="Name"
            className="h-8 text-xs"
          />
          <select
            value={assignee.role}
            onChange={(e) => setAssignee((a) => ({ ...a, role: e.target.value as any }))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {ASSIGNEE_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <Input
            value={assignee.whatsapp}
            onChange={(e) => setAssignee((a) => ({ ...a, whatsapp: e.target.value }))}
            placeholder="WhatsApp"
            className="h-8 text-xs"
          />
          <Input
            value={assignee.phone}
            onChange={(e) => setAssignee((a) => ({ ...a, phone: e.target.value }))}
            placeholder="Phone"
            className="h-8 text-xs"
          />
          <Input
            value={assignee.email}
            onChange={(e) => setAssignee((a) => ({ ...a, email: e.target.value }))}
            placeholder="Email"
            className="h-8 text-xs"
          />
          <Input
            value={assignee.messenger}
            onChange={(e) => setAssignee((a) => ({ ...a, messenger: e.target.value }))}
            placeholder="Messenger link"
            className="h-8 text-xs"
          />
        </div>
        <Input
          value={assignee.response_time}
          onChange={(e) => setAssignee((a) => ({ ...a, response_time: e.target.value }))}
          placeholder="Response time (e.g. within 2 hours)"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!assignee.name.trim() || busy === "assign"}
          onClick={() =>
            run(
              "assign",
              () =>
                assignFn({
                  data: {
                    orderId,
                    name: assignee.name.trim(),
                    role: assignee.role,
                    whatsapp: assignee.whatsapp || null,
                    messenger: assignee.messenger || null,
                    email: assignee.email || null,
                    phone: assignee.phone || null,
                    response_time: assignee.response_time || null,
                  },
                }),
              "Assignment saved",
            )
          }
        >
          Save assignment
        </Button>
      </Block>

      {/* Deliverables */}
      <Block icon={FileDown} title={`Deliverables (${d.deliverables.length})`}>
        <ul className="space-y-1">
          {d.deliverables.map((x: any) => (
            <li key={x.id} className="flex items-start justify-between gap-2 rounded bg-muted/40 p-2 text-[11px]">
              <div className="min-w-0">
                <div className="truncate font-medium">{x.title}</div>
                <div className="text-muted-foreground capitalize">
                  {x.kind} {x.download_limit ? `· limit ${x.download_limit}` : ""}{" "}
                  {x.expires_at ? `· expires ${new Date(x.expires_at).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button
                onClick={() => run("del", () => delDelivFn({ data: { id: x.id } }), "Deleted")}
                className="opacity-60 hover:opacity-100"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={deliv.kind}
            onChange={(e) => setDeliv((v) => ({ ...v, kind: e.target.value }))}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {DELIVERABLE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <Input
            value={deliv.title}
            onChange={(e) => setDeliv((v) => ({ ...v, title: e.target.value }))}
            placeholder="Title"
            className="h-8 text-xs"
          />
        </div>
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-8 text-xs" />
        <Input
          value={deliv.external_url}
          onChange={(e) => setDeliv((v) => ({ ...v, external_url: e.target.value }))}
          placeholder="External link (optional)"
          className="h-8 text-xs"
        />
        <Input
          value={deliv.secret_value}
          onChange={(e) => setDeliv((v) => ({ ...v, secret_value: e.target.value }))}
          placeholder="Credential / activation key (optional)"
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={deliv.expires_at}
            onChange={(e) => setDeliv((v) => ({ ...v, expires_at: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            type="number"
            min={1}
            value={deliv.download_limit}
            onChange={(e) => setDeliv((v) => ({ ...v, download_limit: e.target.value }))}
            placeholder="Download limit"
            className="h-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!deliv.title.trim() || busy === "deliv"}
          onClick={() =>
            run(
              "deliv",
              async () => {
                const payload: any = {
                  orderId,
                  kind: deliv.kind,
                  title: deliv.title.trim(),
                  external_url: deliv.external_url || null,
                  secret_value: deliv.secret_value || null,
                  expires_at: deliv.expires_at ? new Date(deliv.expires_at).toISOString() : null,
                  download_limit: deliv.download_limit ? Number(deliv.download_limit) : null,
                };
                if (file) {
                  payload.file = { name: file.name, data: await fileToB64(file), type: file.type || undefined };
                }
                await addDelivFn({ data: payload });
                setFile(null);
                setDeliv({ kind: "file", title: "", external_url: "", secret_value: "", expires_at: "", download_limit: "" });
              },
              "Deliverable added",
            )
          }
        >
          Add deliverable
        </Button>
      </Block>

      {/* Revisions */}
      <Block icon={RefreshCcw} title={`Revisions (${d.revisions.length}) · allowed ${revisionsAllowed}`}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            defaultValue={revisionsAllowed}
            className="h-8 w-24 text-xs"
            onBlur={(e) =>
              Number(e.target.value) !== revisionsAllowed &&
              run("grant", () => grantFn({ data: { orderId, allowed: Number(e.target.value) } }), "Revision limit updated")
            }
          />
          <span className="text-[11px] text-muted-foreground">Allowed revisions for this order</span>
        </div>
        <ul className="space-y-1">
          {d.revisions.map((r: any) => (
            <li key={r.id} className="rounded bg-muted/40 p-2 text-[11px]">
              <div>{r.request_text}</div>
              <div className="text-muted-foreground capitalize">
                {r.status} · {new Date(r.created_at).toLocaleString()}
              </div>
              {r.admin_response && <div className="mt-0.5">Reply: {r.admin_response}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                {["in_progress", "delivered", "rejected"].map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      run("rev", () => revisionFn({ data: { id: r.id, status: s as any } }), "Revision updated")
                    }
                    className="rounded border px-1.5 py-0.5 capitalize hover:bg-muted"
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {d.revisions.length === 0 && <li className="text-[11px] text-muted-foreground">No revision requests.</li>}
        </ul>
      </Block>

      {/* Client files */}
      <Block icon={Paperclip} title={`Client files (${d.files.length})`}>
        <ul className="space-y-1">
          {d.files.map((f: any) => (
            <li key={f.id} className="truncate rounded bg-muted/40 p-2 text-[11px]">
              {f.file_name ?? f.path}
            </li>
          ))}
          {d.files.length === 0 && <li className="text-[11px] text-muted-foreground">No uploads.</li>}
        </ul>
      </Block>

      {/* Review */}
      {d.review && (
        <Block icon={Star} title={`Review · ${d.review.rating}/5`}>
          <p className="text-[11px]">{d.review.review_text ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">
            {d.review.recommend ? "Recommends this store" : "Does not recommend"}
          </p>
        </Block>
      )}
    </div>
  );
}
