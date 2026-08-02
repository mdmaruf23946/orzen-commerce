import { useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  FileArchive, FileText, Code2, Image as ImageIcon, Figma, Palette, Video, Music,
  LayoutTemplate, Type, ShieldCheck, BookOpen, Gift, Check, ChevronDown,
} from "lucide-react";
import {
  INCLUDED_ITEMS,
  LICENSE_DESCRIPTIONS,
  LICENSE_LABELS,
  formatBytes,
  toEmbedUrl,
  type DigitalFaq,
  type DigitalRequirements,
  type LicenseType,
} from "@/lib/digital";

/* ------------------------------------------------------------------ preview */

type PreviewProps = {
  name: string;
  images: string[];
  videoUrl?: string | null;
  pdfUrl?: string | null;
  audioUrl?: string | null;
  demoUrl?: string | null;
};

export function DigitalPreview({ name, images, videoUrl, pdfUrl, audioUrl, demoUrl }: PreviewProps) {
  const [active, setActive] = useState(0);
  const embed = toEmbedUrl(videoUrl);
  const hasAny = images.length > 0 || embed || pdfUrl || audioUrl || demoUrl;
  if (!hasAny) return null;

  return (
    <Section title="Preview" id="preview">
      <div className="space-y-4">
        {embed && (
          <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted">
            <iframe
              src={embed}
              title={`${name} preview video`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {images.length > 0 && (
          <div>
            <div className="overflow-hidden rounded-xl border bg-muted">
              <img
                src={images[Math.min(active, images.length - 1)]}
                alt={`${name} preview ${active + 1}`}
                className="h-auto w-full object-contain"
                loading="lazy"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition ${
                      i === active ? "border-primary ring-2 ring-primary/30" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {pdfUrl && (
          <div className="h-[520px] w-full overflow-hidden rounded-xl border bg-muted">
            <iframe src={pdfUrl} title={`${name} PDF preview`} className="h-full w-full" />
          </div>
        )}

        {audioUrl && (
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Audio sample</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}

        {demoUrl && (
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Open live demo ↗
          </a>
        )}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- description */

function sanitize(html: string) {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  const source = looksLikeHtml ? html : html.replace(/\n/g, "<br />");
  return DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h1", "h2", "h3", "h4",
      "h5", "h6", "blockquote", "a", "hr", "span", "div", "img", "table", "thead", "tbody",
      "tr", "th", "td", "figure", "figcaption", "iframe",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "width", "height", "allowfullscreen"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}

export function DigitalDescription({ html, features }: { html: string | null; features: string[] }) {
  if (!html && features.length === 0) return null;
  return (
    <Section title="Description" id="description">
      {html && (
        <div
          className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitize(html) }}
        />
      )}
      {features.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground/80">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ----------------------------------------------------------- what's included */

const INCLUDED_ICONS: Record<string, typeof FileText> = {
  zip: FileArchive,
  pdf: FileText,
  source: Code2,
  psd: ImageIcon,
  figma: Figma,
  canva: Palette,
  video: Video,
  audio: Music,
  templates: LayoutTemplate,
  fonts: Type,
  license: ShieldCheck,
  docs: BookOpen,
  bonus: Gift,
};

export function DigitalIncluded({ ids }: { ids: string[] }) {
  const items = INCLUDED_ITEMS.filter((i) => ids.includes(i.id));
  if (items.length === 0) return null;
  return (
    <Section title="What's included" id="included">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const Icon = INCLUDED_ICONS[it.id] ?? FileText;
          return (
            <div key={it.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{it.label}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- system requirements */

const REQ_LABELS: { key: keyof DigitalRequirements; label: string }[] = [
  { key: "os", label: "Operating system" },
  { key: "software", label: "Software version" },
  { key: "browser", label: "Browser support" },
  { key: "ram", label: "RAM" },
  { key: "storage", label: "Storage" },
  { key: "dependencies", label: "Dependencies" },
];

export function DigitalRequirementsTable({ req }: { req: DigitalRequirements }) {
  const rows = REQ_LABELS.filter(({ key }) => (req?.[key] ?? "").toString().trim() !== "");
  if (rows.length === 0) return null;
  return (
    <Section title="System requirements" id="requirements">
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(({ key, label }, i) => (
              <tr key={key} className={i % 2 ? "bg-muted/40" : ""}>
                <th className="w-2/5 px-3 py-2 text-left font-medium text-muted-foreground">{label}</th>
                <td className="px-3 py-2 text-foreground">{req[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- license */

export function DigitalLicense({ type, note }: { type: LicenseType; note?: string | null }) {
  const label = LICENSE_LABELS[type] ?? LICENSE_LABELS.personal;
  const desc = LICENSE_DESCRIPTIONS[type] ?? LICENSE_DESCRIPTIONS.personal;
  return (
    <Section title="License information" id="license">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <p className="font-semibold">{label}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        {note && <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{note}</p>}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------- faq */

export function DigitalFaqList({ items }: { items: DigitalFaq[] }) {
  const rows = (items ?? []).filter((f) => f?.q?.trim());
  if (rows.length === 0) return null;
  return (
    <Section title="Frequently asked questions" id="faq">
      <div className="space-y-2">
        {rows.map((f, i) => (
          <details key={i} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
              {f.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t px-4 py-3 text-sm text-muted-foreground whitespace-pre-line">{f.a}</div>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- changelog */

export function DigitalChangelog({ text, version }: { text?: string | null; version?: string | null }) {
  if (!text) return null;
  return (
    <Section title={version ? `Changelog — v${version}` : "Changelog"} id="changelog">
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm text-foreground/80">
        {text}
      </pre>
    </Section>
  );
}

/* ------------------------------------------------------------- file summary */

export function DigitalFileInfo({
  fileCount,
  totalSize,
  fileTypes,
  version,
  updatedAt,
  platforms,
}: {
  fileCount: number;
  totalSize: number;
  fileTypes: string[];
  version?: string | null;
  updatedAt?: string | null;
  platforms: string[];
}) {
  const rows: [string, string][] = [];
  if (fileCount) rows.push(["Files", `${fileCount} file${fileCount > 1 ? "s" : ""}`]);
  const size = formatBytes(totalSize);
  if (size) rows.push(["File size", size]);
  if (fileTypes.length) rows.push(["File types", fileTypes.join(", ").toUpperCase()]);
  if (version) rows.push(["Version", version]);
  if (updatedAt) rows.push(["Last updated", new Date(updatedAt).toLocaleDateString()]);
  if (platforms.length) rows.push(["Compatible with", platforms.join(", ")]);
  if (rows.length === 0) return null;

  return (
    <Section title="File information" id="files">
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v], i) => (
              <tr key={k} className={i % 2 ? "bg-muted/40" : ""}>
                <th className="w-2/5 px-3 py-2 text-left font-medium text-muted-foreground">{k}</th>
                <td className="px-3 py-2 text-foreground">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ shared */

export function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8">
      <h2 className="mb-3 text-base font-bold sm:text-lg">{title}</h2>
      {children}
    </section>
  );
}
