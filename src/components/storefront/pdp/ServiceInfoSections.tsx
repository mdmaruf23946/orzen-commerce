// Storefront rendering of the service-only metadata saved by the
// Service product form (products.meta.service).
import { Check, Clock, HelpCircle, ListChecks, Package, ShieldCheck } from "lucide-react";

type Addon = { name: string; price?: number | null; description?: string };
type Faq = { question: string; answer: string };

export function ServiceInfoSections({ service }: { service: any }) {
  if (!service || typeof service !== "object") return null;

  const included: string[] = Array.isArray(service.included) ? service.included : [];
  const requirements: string[] = Array.isArray(service.requirements) ? service.requirements : [];
  const deliverables: string[] = Array.isArray(service.deliverables) ? service.deliverables : [];
  const addons: Addon[] = Array.isArray(service.addons) ? service.addons : [];
  const faq: Faq[] = Array.isArray(service.faq) ? service.faq : [];
  const policies = service.policies ?? {};
  const delivery = service.delivery ?? {};
  const deliveryText = delivery.time ? `${delivery.time} ${delivery.unit ?? "days"}` : null;

  const hasAny =
    included.length ||
    requirements.length ||
    deliverables.length ||
    addons.length ||
    faq.length ||
    deliveryText ||
    policies.refund ||
    policies.cancellation ||
    policies.terms ||
    policies.warranty;
  if (!hasAny) return null;

  return (
    <div className="mt-6 space-y-4">
      {(deliveryText || delivery.express) && (
        <Block icon={<Clock className="h-4 w-4" />} title="Delivery">
          <p className="text-sm text-muted-foreground">
            Estimated delivery: {deliveryText ?? "—"}
            {delivery.express
              ? ` · Express available${delivery.express_time ? ` (${delivery.express_time})` : ""}${
                  delivery.express_fee ? ` for ৳${delivery.express_fee}` : ""
                }`
              : ""}
          </p>
        </Block>
      )}

      {included.length > 0 && (
        <Block icon={<Check className="h-4 w-4" />} title="What's included">
          <BulletList items={included} />
        </Block>
      )}

      {requirements.length > 0 && (
        <Block icon={<ListChecks className="h-4 w-4" />} title="What we need from you">
          <BulletList items={requirements} />
        </Block>
      )}

      {deliverables.length > 0 && (
        <Block icon={<Package className="h-4 w-4" />} title="Deliverables">
          <BulletList items={deliverables} />
        </Block>
      )}

      {addons.length > 0 && (
        <Block icon={<Plusish />} title="Optional add-ons">
          <ul className="divide-y">
            {addons.map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                </div>
                {a.price != null && <span className="shrink-0 text-sm font-semibold">৳{a.price}</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {faq.length > 0 && (
        <Block icon={<HelpCircle className="h-4 w-4" />} title="FAQ">
          <div className="space-y-2">
            {faq.map((f, i) => (
              <details key={i} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">{f.question}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </Block>
      )}

      {(policies.refund || policies.cancellation || policies.terms || policies.warranty) && (
        <Block icon={<ShieldCheck className="h-4 w-4" />} title="Policies">
          <div className="space-y-2 text-sm text-muted-foreground">
            {policies.refund && <Policy label="Refund" text={policies.refund} />}
            {policies.cancellation && <Policy label="Cancellation" text={policies.cancellation} />}
            {policies.terms && <Policy label="Service terms" text={policies.terms} />}
            {policies.warranty && <Policy label="Warranty & support" text={policies.warranty} />}
          </div>
        </Block>
      )}
    </div>
  );
}

function Plusish() {
  return <span className="text-sm font-bold leading-none">+</span>;
}

function Policy({ label, text }: { label: string; text: string }) {
  return (
    <p>
      <span className="font-medium text-foreground">{label}: </span>
      {text}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
