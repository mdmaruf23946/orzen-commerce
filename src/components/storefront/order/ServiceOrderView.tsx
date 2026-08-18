import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2, Clock, CalendarClock, Video, MapPin, MessageCircle, Mail, Phone,
  ReceiptText, Download, RefreshCw, Star, ShoppingBag, FileText, KeyRound, Info, XCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getServiceOrder, requestServiceRevision, submitServiceReview,
  requestServiceCancel, requestServiceDeliverable,
} from "@/lib/service-order.functions";
import { SERVICE_STAGE_LABEL, stageFlow, type ServiceStage } from "@/lib/service-workflow";
import { readToken } from "@/lib/customer-session";


function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function useCountdown(iso?: string | null) {
  const [, force] = useState(0);
  useMemo(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return d > 0 ? `in ${d}d ${h}h` : h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

const contactKey = (orderId: string) => `orzen_order_contact__${orderId}`;

function readContact(orderId: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(contactKey(orderId)) ?? "";
  } catch {
    return "";
  }
}

export function ServiceOrderView({ order, slug }: { order: any; slug: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getServiceOrder);
  const token = readToken(slug);
  const [contact, setContact] = useState(() => readContact(order.id));
  const [contactInput, setContactInput] = useState("");

  // Ownership proof sent with every service-order call — an order id alone
  // must never unlock deliverables, secrets or write actions.
  const proof = useMemo(
    () => ({
      ...(order.store_id ? { storeId: order.store_id as string } : {}),
      ...(token ? { token } : {}),
      ...(contact ? { contact } : {}),
    }),
    [order.store_id, token, contact],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["serviceOrder", order.id, token, contact],
    queryFn: () => load({ data: { orderId: order.id, ...proof } }),
    refetchInterval: 30_000,
  });
  const verified = !!data?.verified;

  const askRevision = useServerFn(requestServiceRevision);
  const sendReview = useServerFn(submitServiceReview);
  const askCancel = useServerFn(requestServiceCancel);
  const getFile = useServerFn(requestServiceDeliverable);

  const [revText, setRevText] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [recommend, setRecommend] = useState(true);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["serviceOrder", order.id] });

  function submitContact(e: React.FormEvent) {
    e.preventDefault();
    const value = contactInput.trim();
    if (!value) return;
    try {
      window.localStorage.setItem(contactKey(order.id), value);
    } catch {
      /* ignore */
    }
    setContact(value);
  }

  const revMut = useMutation({
    mutationFn: () => askRevision({ data: { orderId: order.id, text: revText, ...proof } }),
    onSuccess: () => { setRevText(""); toast.success("Revision requested"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not request revision"),
  });
  const reviewMut = useMutation({
    mutationFn: () => sendReview({ data: { orderId: order.id, rating, text: reviewText, recommend, ...proof } }),
    onSuccess: () => { toast.success("Thanks for your review"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit review"),
  });
  const cancelMut = useMutation({
    mutationFn: () => askCancel({ data: { orderId: order.id, ...proof } }),
    onSuccess: () => { toast.success("Cancellation requested"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not request cancellation"),
  });
  const fileMut = useMutation({
    mutationFn: (id: string) => getFile({ data: { orderId: order.id, deliverableId: id, ...proof } }),
    onSuccess: (r: any) => {
      if (r?.url) window.open(r.url, "_blank", "noopener");
      else if (r?.secret) toast.success(r.secret, { duration: 15_000 });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Download failed"),
  });


  const meta = (order.fulfillment_meta ?? {}) as any;
  const service = meta.service ?? {};
  const intake: Record<string, any> = service.intake ?? meta.intake ?? {};
  const advance = Number(service.advance_amount ?? 0);
  const total =
    Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0) - Number(order.discount_amount ?? 0);
  const paidAmount = order.payment_status === "paid" ? total : advance > 0 ? advance : 0;
  const due = Math.max(0, total - paidAmount);

  const flow = stageFlow(data?.settings?.enabled_stages as string[] | undefined);
  const current = (data?.currentStage ?? "request_submitted") as ServiceStage;
  const currentIdx = Math.max(0, flow.indexOf(current));
  const nextMeeting = (data?.meetings ?? []).find((m: any) => new Date(m.starts_at).getTime() > Date.now() - 3_600_000);
  const countdown = useCountdown(nextMeeting?.starts_at);
  const assignment = data?.assignment as any;
  const completed = current === "completed" || current === "closed";

  return (
    <div className="mx-auto max-w-lg py-8">
      {/* 1. Success header */}
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 animate-in zoom-in place-items-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </span>
        <h1 className="mt-3 text-2xl font-semibold">Service Request Submitted</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you for your order. Your request has been received and will be reviewed shortly.
        </p>
        <div className="mt-4 rounded-xl border bg-card p-4 text-left text-sm">
          <Row label="Service ID" value={<span className="font-mono">{order.invoice_no ?? order.id.slice(0, 8).toUpperCase()}</span>} />
          <Row label="Order date" value={new Date(order.created_at).toLocaleString()} />
          <Row
            label="Payment status"
            value={
              <span className={order.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}>
                {String(order.payment_status ?? "pending").toUpperCase()}
              </span>
            }
          />
        </div>
      </div>

      {!isLoading && !verified && (
        <form onSubmit={submitContact} className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">Verify it's your order</p>
          <p className="text-xs text-muted-foreground">
            Enter the phone number or email you used at checkout to unlock files, meeting details and
            order actions.
          </p>
          <div className="flex gap-2">
            <input
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Phone or email"
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Unlock
            </button>
          </div>
        </form>
      )}



      {isLoading && (
        <div className="mt-6 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* 2. Service progress */}
      <Card title="Service progress" icon={<Clock className="h-3 w-3" />}>
        <ol className="space-y-3">
          {flow.map((stage, i) => {
            const done = i <= currentIdx;
            const event = (data?.progress ?? []).find((p: any) => p.stage === stage);
            return (
              <li key={stage} className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30"}`}>
                  {done && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                    {SERVICE_STAGE_LABEL[stage]}
                  </p>
                  {event && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                      {event.note ? ` · ${event.note}` : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* 4. Appointment / meeting */}
      {nextMeeting && (
        <Card title="Appointment" icon={<CalendarClock className="h-3 w-3" />}>
          <Row label="Date & time" value={new Date(nextMeeting.starts_at).toLocaleString()} />
          <Row label="Time zone" value={nextMeeting.timezone} />
          <Row label="Duration" value={nextMeeting.duration_minutes ? `${nextMeeting.duration_minutes} min` : null} />
          <Row label="Platform" value={String(nextMeeting.platform).replace(/_/g, " ")} />
          <Row label="Location" value={nextMeeting.office_address} />
          <Row label="Passcode" value={nextMeeting.passcode ? <span className="font-mono">{nextMeeting.passcode}</span> : null} />
          <Row label="Starts" value={countdown} />
          {nextMeeting.notes && <p className="mt-2 text-xs text-muted-foreground">{nextMeeting.notes}</p>}
          {nextMeeting.meeting_link && (
            <a href={nextMeeting.meeting_link} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground">
              <Video className="h-4 w-4" /> Join meeting
            </a>
          )}
          {!nextMeeting.meeting_link && nextMeeting.office_address && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> On-site meeting
            </p>
          )}
        </Card>
      )}

      {/* 5. Communication */}
      <Card title="Communication" icon={<MessageCircle className="h-3 w-3" />}>
        {assignment ? (
          <>
            <Row label={assignment.role === "freelancer" ? "Assigned freelancer" : assignment.role === "agent" ? "Assigned agent" : "Assigned staff"} value={assignment.name} />
            <Row label="Response time" value={assignment.response_time ?? data?.settings?.response_time} />
            <Row label="Last reply" value={assignment.last_reply_at ? new Date(assignment.last_reply_at).toLocaleString() : null} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Our team will be assigned to your request shortly.
            {data?.settings?.response_time ? ` Typical response time: ${data.settings.response_time}.` : ""}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(assignment?.whatsapp ?? data?.settings?.support_whatsapp) && (
            <a className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm"
              href={`https://wa.me/${String(assignment?.whatsapp ?? data?.settings?.support_whatsapp).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {(assignment?.messenger ?? data?.settings?.support_messenger) && (
            <a className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm"
              href={String(assignment?.messenger ?? data?.settings?.support_messenger)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> Messenger
            </a>
          )}
          {(assignment?.email ?? data?.settings?.support_email) && (
            <a className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm"
              href={`mailto:${assignment?.email ?? data?.settings?.support_email}`}>
              <Mail className="h-4 w-4" /> Email
            </a>
          )}
          {(assignment?.phone ?? data?.settings?.support_phone) && (
            <a className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm"
              href={`tel:${assignment?.phone ?? data?.settings?.support_phone}`}>
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </div>
      </Card>

      {/* 6. Payment */}
      <Card title="Payment" icon={<ReceiptText className="h-3 w-3" />}>
        <Row label="Status" value={String(order.payment_status ?? "pending").toUpperCase()} />
        <Row label="Total" value={`৳${total.toFixed(0)}`} />
        <Row label="Paid" value={`৳${paidAmount.toFixed(0)}`} />
        {due > 0 && <Row label="Remaining" value={<span className="text-amber-600">৳{due.toFixed(0)}</span>} />}
        <Row label="Method" value={String(order.payment_method ?? "").toUpperCase()} />
        <Row label="Transaction ID" value={order.txn_id ? <span className="font-mono">{order.txn_id}</span> : null} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`/api/invoice/${order.id}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
            <ReceiptText className="h-4 w-4" /> Invoice
          </a>
          {due > 0 && (
            <Link to="/store/$slug/checkout" params={{ slug }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground">
              Complete payment
            </Link>
          )}
        </div>
      </Card>

      {/* 7. Service information */}
      <Card title="Service details" icon={<FileText className="h-3 w-3" />}>
        <ul className="space-y-2 text-sm">
          {((order.items as any[]) ?? []).map((i: any, idx: number) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>{i.name_snapshot}{i.qty > 1 ? ` × ${i.qty}` : ""}</span>
              <span>৳{(Number(i.price_snapshot) * i.qty).toFixed(0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t pt-2">
          <Row label="Package" value={service.package_name ?? service.package} />
          <Row label="Delivery type" value={service.delivery_type} />
          <Row label="Estimated delivery" value={service.delivery_time ?? service.estimated_delivery} />
          <Row label="Revisions" value={data ? `${data.revisionsRemaining} of ${data.revisionsAllowed} left` : null} />
        </div>
        {Array.isArray(service.addons) && service.addons.length > 0 && (
          <div className="mt-2 border-t pt-2 text-sm">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Selected options</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {service.addons.map((a: any, i: number) => (
                <li key={i}>{a.name ?? a.label}{a.price ? ` — ৳${Number(a.price).toFixed(0)}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(service.included) && service.included.length > 0 && (
          <div className="mt-2 border-t pt-2 text-sm">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Included</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {service.included.map((f: any, i: number) => <li key={i}>{typeof f === "string" ? f : f.label}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* 8. Client submitted information */}
      <Card title="Your information" icon={<Info className="h-3 w-3" />}>
        <Row label="Name" value={order.customer_name} />
        <Row label="Phone" value={order.phone} />
        <Row label="Email" value={order.email} />
        <Row label="Business name" value={order.company ?? intake.business_name} />
        <Row label="Website" value={intake.website} />
        <Row label="Country" value={order.country} />
        {Object.entries(intake)
          .filter(([k]) => !["website", "business_name"].includes(k))
          .map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, " ")} value={typeof v === "object" ? JSON.stringify(v) : String(v ?? "")} />
          ))}
        {order.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>}
        {(data?.files ?? []).length > 0 && (
          <div className="mt-3 border-t pt-2">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Attachments</p>
            <ul className="space-y-1 text-sm">
              {(data?.files ?? []).map((f: any) => (
                <li key={f.id} className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> {f.file_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 9. Admin updates */}
      {(data?.updates ?? []).length > 0 && (
        <Card title="Updates from the team" icon={<Info className="h-3 w-3" />}>
          <ol className="space-y-3">
            {(data?.updates ?? []).map((u: any, i: number) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{u.status_label}</p>
                {u.note && <p className="text-sm text-muted-foreground">{u.note}</p>}
                <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 10. File delivery */}
      {(data?.deliverables ?? []).length > 0 && (
        <Card title="Your deliverables" icon={<Download className="h-3 w-3" />}>
          <ul className="space-y-3">
            {(data?.deliverables ?? []).map((d: any) => {
              const expired = d.expires_at && new Date(d.expires_at).getTime() < Date.now();
              const limited = d.download_limit != null && d.download_count >= d.download_limit;
              return (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs uppercase text-muted-foreground">{String(d.kind).replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.download_limit != null ? `${d.download_count}/${d.download_limit} downloads` : `${d.download_count} downloads`}
                      {d.expires_at ? ` · expires ${new Date(d.expires_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <button
                    disabled={!!expired || !!limited || fileMut.isPending}
                    onClick={() => fileMut.mutate(d.id)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50"
                  >
                    {d.has_secret ? <KeyRound className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {expired ? "Expired" : limited ? "Limit reached" : d.has_secret ? "Reveal" : "Download"}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* 11. Revisions */}
      {(data?.revisionsAllowed ?? 0) > 0 && (
        <Card title="Revisions" icon={<RefreshCw className="h-3 w-3" />}>
          <p className="text-sm">
            <span className="font-semibold">{data?.revisionsRemaining}</span> revision(s) remaining
          </p>
          {(data?.revisions ?? []).length > 0 && (
            <ol className="mt-3 space-y-2">
              {(data?.revisions ?? []).map((r: any) => (
                <li key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase text-muted-foreground">{r.status}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{r.request_text}</p>
                  {r.admin_response && <p className="mt-1 text-muted-foreground">Reply: {r.admin_response}</p>}
                  {r.deadline_at && (
                    <p className="mt-1 text-xs text-muted-foreground">Deadline: {new Date(r.deadline_at).toLocaleString()}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          {(data?.revisionsRemaining ?? 0) > 0 && (
            <div className="mt-3">
              <textarea
                value={revText}
                onChange={(e) => setRevText(e.target.value)}
                rows={3}
                placeholder="What should we change?"
                className="w-full rounded-md border bg-background p-2 text-sm"
              />
              <button
                disabled={revText.trim().length < 5 || revMut.isPending}
                onClick={() => revMut.mutate()}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Request revision
              </button>
            </div>
          )}
        </Card>
      )}

      {/* 12. Rating & review */}
      {completed && data?.settings?.allow_reviews && (
        <Card title="Rate this service" icon={<Star className="h-3 w-3" />}>
          {data.review ? (
            <div className="text-sm">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${n <= data.review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                ))}
              </div>
              {data.review.review_text && <p className="mt-2 text-muted-foreground">{data.review.review_text}</p>}
            </div>
          ) : (
            <>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                placeholder="Write a review (optional)"
                className="mt-3 w-full rounded-md border bg-background p-2 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={recommend} onChange={(e) => setRecommend(e.target.checked)} />
                I recommend this store
              </label>
              <button
                disabled={reviewMut.isPending}
                onClick={() => reviewMut.mutate()}
                className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Submit review
              </button>
            </>
          )}
        </Card>
      )}

      {/* 13. Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/store/$slug" params={{ slug }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
          <ShoppingBag className="h-4 w-4" /> Place new order
        </Link>
        <Link to="/store/$slug/account" params={{ slug }} search={{ tab: "orders" as any }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
          <FileText className="h-4 w-4" /> My orders
        </Link>
        {data?.settings?.allow_cancel && !completed && !data?.cancelRequested && (
          <button
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-destructive/40 text-sm font-medium text-destructive disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Cancel request
          </button>
        )}
        {data?.cancelRequested && (
          <p className="col-span-2 rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
            Cancellation requested — our team will contact you.
          </p>
        )}
      </div>

      <Link to="/store/$slug" params={{ slug }}
        className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
        ← Back to store
      </Link>
    </div>
  );
}
