import { useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";

type Section = { id: string; label: string; render: () => React.ReactNode };

function sanitize(html: string) {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  const source = looksLikeHtml ? html : html.replace(/\n/g, "<br />");
  return DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "hr", "span", "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}

type Props = {
  description: string | null;
  features: string[];
  specifications: Record<string, string>;
  packageIncludes: string[];
  deliveryInfo: string | null;
  returnPolicy: string | null;
  warranty: string | null;
};

export function InfoTabs(props: Props) {
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (props.description) {
      const clean = sanitize(props.description);
      out.push({
        id: "desc",
        label: "Description",
        render: () => (
          <div
            className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: clean }}
          />
        ),
      });
    }
    if (props.features.length > 0) {
      out.push({
        id: "features",
        label: "Key Features",
        render: () => (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {props.features.map((f, i) => (
              <li key={i} className="text-foreground/80">{f}</li>
            ))}
          </ul>
        ),
      });
    }
    const specEntries = Object.entries(props.specifications).filter(([, v]) => v != null && String(v).trim() !== "");
    if (specEntries.length > 0) {
      out.push({
        id: "specs",
        label: "Specifications",
        render: () => (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {specEntries.map(([k, v], i) => (
                  <tr key={k} className={i % 2 ? "bg-muted/40" : ""}>
                    <th className="w-1/3 px-3 py-2 text-left font-medium capitalize text-muted-foreground">{k}</th>
                    <td className="px-3 py-2 text-foreground">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      });
    }
    if (props.packageIncludes.length > 0) {
      out.push({
        id: "package",
        label: "Package Includes",
        render: () => (
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
            {props.packageIncludes.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        ),
      });
    }
    if (props.deliveryInfo || props.returnPolicy) {
      out.push({
        id: "delivery",
        label: "Delivery & Return",
        render: () => (
          <div className="space-y-3 text-sm text-foreground/80">
            {props.deliveryInfo && (
              <div>
                <p className="font-semibold text-foreground">Delivery</p>
                <p className="text-muted-foreground">{props.deliveryInfo}</p>
              </div>
            )}
            {props.returnPolicy && (
              <div>
                <p className="font-semibold text-foreground">Return Policy</p>
                <p className="whitespace-pre-line text-muted-foreground">{props.returnPolicy}</p>
              </div>
            )}
          </div>
        ),
      });
    }
    if (props.warranty) {
      out.push({
        id: "warranty",
        label: "Warranty",
        render: () => <p className="whitespace-pre-line text-sm text-foreground/80">{props.warranty}</p>,
      });
    }
    return out;
  }, [props]);

  const [active, setActive] = useState(sections[0]?.id);

  if (sections.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Desktop tabs */}
      <div className="hidden md:block">
        <div className="flex flex-wrap gap-1 border-b">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                active === s.id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="pt-5">
          {sections.find((s) => s.id === active)?.render()}
        </div>
      </div>

      {/* Mobile accordion */}
      <div className="space-y-2 md:hidden">
        {sections.map((s) => (
          <details key={s.id} className="group rounded-xl border bg-white" open={s.id === sections[0].id}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
              {s.label}
              <span className="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t px-4 py-3">{s.render()}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
