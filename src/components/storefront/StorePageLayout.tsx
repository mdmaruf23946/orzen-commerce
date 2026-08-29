import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

type StoreInfo = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
} | null;

const PROSE =
  "prose prose-sm max-w-none text-sf-text sm:prose-base [&_a]:text-sf-accent [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-sf-ink [&_h3]:font-semibold [&_h3]:text-sf-ink [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5";

export function StorePageShell({
  slug,
  title,
  storeName,
  updatedAt,
  children,
}: {
  slug: string;
  title: string;
  storeName?: string | null;
  updatedAt?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 min-h-[calc(100dvh-3.5rem)] bg-sf-surface px-4 py-6 sm:-mx-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-3 text-xs text-sf-muted">
          <Link to="/store/$slug" params={{ slug }} className="hover:text-sf-accent">
            {storeName || "Home"}
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-sf-text">{title}</span>
        </nav>

        <div className="rounded-2xl border border-sf-line bg-sf-card p-5 shadow-sm sm:p-8">
          <header className="mb-5 border-b border-sf-line pb-4">
            <h1 className="text-2xl font-bold text-sf-ink sm:text-3xl">{title}</h1>
            {updatedAt && (
              <p className="mt-1 text-xs text-sf-muted">
                Last updated: {new Date(updatedAt).toLocaleDateString()}
              </p>
            )}
          </header>
          {children}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            to="/store/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-2 rounded-full bg-sf-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sf-accent-hover"
          >
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Renders saved rich-text content, or a clean placeholder template when empty. */
export function StorePageBody({
  html,
  title,
  store,
}: {
  html?: string | null;
  title: string;
  store: StoreInfo;
}) {
  const hasContent = !!html && html.replace(/<[^>]*>/g, "").trim().length > 0;
  if (hasContent) {
    // Sanitized server-side (allowlisted tags/attributes) before it is stored.
    return <article className={PROSE} dangerouslySetInnerHTML={{ __html: html! }} />;
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-sf-muted">
        We are still preparing the <span className="font-semibold text-sf-ink">{title}</span>{" "}
        content for {store?.name || "this store"}. In the meantime, our team is happy to answer any
        question directly.
      </p>
      <div className="rounded-xl border border-sf-line bg-sf-surface p-4">
        <h2 className="text-sm font-bold text-sf-ink">Contact us</h2>
        <ul className="mt-3 space-y-2 text-sm text-sf-muted">
          {store?.phone && (
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-sf-accent" />
              <a href={`tel:${store.phone}`} className="hover:text-sf-accent">
                {store.phone}
              </a>
            </li>
          )}
          {store?.email && (
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-sf-accent" />
              <a href={`mailto:${store.email}`} className="hover:text-sf-accent">
                {store.email}
              </a>
            </li>
          )}
          {store?.address && (
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sf-accent" />
              <span>{store.address}</span>
            </li>
          )}
          {!store?.phone && !store?.email && !store?.address && (
            <li>Contact details will be published soon.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
