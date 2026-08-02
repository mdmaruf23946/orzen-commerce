// Storefront rendering of subscription-only metadata saved by the
// Subscription product form (products.meta.subscription).
import { CalendarClock, Check, Gauge, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { RESET_PERIOD_LABEL, cycleLabel, type SubscriptionMeta } from "@/components/admin/product-form/subscription/subscription-meta";

export function SubscriptionInfoSections({ subscription }: { subscription: any }) {
  if (!subscription || typeof subscription !== "object") return null;
  const sub = subscription as SubscriptionMeta;

  const benefits = Array.isArray(sub.benefits) ? sub.benefits : [];
  const access = Array.isArray(sub.access_items) ? sub.access_items : [];
  const limits = Array.isArray(sub.usage_limits) ? sub.usage_limits : [];
  const policies = sub.policies ?? {};
  const trial = sub.trial;

  const hasAny =
    benefits.length ||
    access.length ||
    limits.length ||
    sub.billing_cycle ||
    policies.refund ||
    policies.cancellation ||
    policies.renewal ||
    policies.terms ||
    policies.warranty;
  if (!hasAny) return null;

  return (
    <div className="mt-6 space-y-4">
      <Block icon={<CalendarClock className="h-4 w-4" />} title="Billing">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Billing cycle: {cycleLabel(sub)}</li>
          {sub.setup_fee ? <li>One-time setup fee: ৳{sub.setup_fee}</li> : null}
          <li>
            Renewal:{" "}
            {sub.renewal_price_mode === "different" && sub.renewal_price != null
              ? `৳${sub.renewal_price} per cycle`
              : "same price on renewal"}
            {sub.renewal?.mode ? ` · ${sub.renewal.mode}` : ""}
          </li>
          {trial?.enabled ? (
            <li>
              Free trial: {trial.duration ?? 0} {trial.unit ?? "days"}
            </li>
          ) : null}
        </ul>
      </Block>

      {benefits.length > 0 && (
        <Block icon={<Sparkles className="h-4 w-4" />} title="Membership benefits">
          <div className="grid gap-2 sm:grid-cols-2">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-lg border p-2.5">
                <p className="text-sm font-medium">{b.title}</p>
                {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
              </div>
            ))}
          </div>
        </Block>
      )}

      {access.length > 0 && (
        <Block icon={<ListChecks className="h-4 w-4" />} title="What you unlock">
          <ul className="space-y-1.5">
            {access.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {a.label}
                  {a.note ? <span className="text-muted-foreground"> — {a.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {limits.length > 0 && (
        <Block icon={<Gauge className="h-4 w-4" />} title="Usage limits">
          <ul className="divide-y text-sm">
            {limits.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                <span>{l.metric}</span>
                <span className="text-muted-foreground">
                  {l.unlimited ? "Unlimited" : (l.limit ?? 0)}
                  {!l.unlimited && l.reset !== "never" ? ` / ${RESET_PERIOD_LABEL[l.reset].toLowerCase()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(policies.refund || policies.cancellation || policies.renewal || policies.terms || policies.warranty) && (
        <Block icon={<ShieldCheck className="h-4 w-4" />} title="Policies">
          <div className="space-y-2 text-sm text-muted-foreground">
            {policies.refund && <Policy label="Refund" text={policies.refund} />}
            {policies.cancellation && <Policy label="Cancellation" text={policies.cancellation} />}
            {policies.renewal && <Policy label="Renewal" text={policies.renewal} />}
            {policies.terms && <Policy label="Terms" text={policies.terms} />}
            {policies.warranty && <Policy label="Warranty" text={policies.warranty} />}
          </div>
        </Block>
      )}
    </div>
  );
}

function Policy({ label, text }: { label: string; text: string }) {
  return (
    <p>
      <span className="font-medium text-foreground">{label}: </span>
      {text}
    </p>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
