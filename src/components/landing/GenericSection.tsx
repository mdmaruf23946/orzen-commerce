// Renders any non-builtin landing-page section from the registry schema.
// The design is system-owned: merchants only supply text and images.

import type { LPFieldSpec, LPSectionSpec } from "@/lib/landing-sections";
import { lpImage } from "@/lib/landing-builder";
import { lpIcon } from "@/lib/landing-icons";
import { BeforeAfter } from "@/components/landing/sections/BeforeAfter";
import { VideoEmbed } from "@/components/landing/sections/VideoEmbed";
import { Gallery } from "@/components/landing/sections/Gallery";
import { ProductGrid, type LandingProductCard } from "@/components/landing/sections/ProductGrid";

type Data = Record<string, any>;
type ScalarField = Exclude<LPFieldSpec, { type: "list" }>;

function scalarFields(spec: LPSectionSpec): ScalarField[] {
  // "products" fields hold picked product IDs — only the ProductGrid renderer
  // consumes them; they must never reach the generic text output.
  return spec.fields.filter((f) => f.type !== "list" && f.type !== "products") as ScalarField[];
}
function listFields(spec: LPSectionSpec) {
  return spec.fields.filter((f) => f.type === "list") as Extract<LPFieldSpec, { type: "list" }>[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/** True when the merchant/AI left the whole section empty. */
export function isBlockEmpty(spec: LPSectionSpec, data: Data): boolean {
  if (spec.render === "products") return false; // products come from the catalogue
  const hasScalar = scalarFields(spec).some((f) => str(data[f.key]));
  const hasList = listFields(spec).some(
    (f) => Array.isArray(data[f.key]) && data[f.key].some((it: Data) => Object.values(it ?? {}).some((v) => str(v))),
  );
  return !hasScalar && !hasList;
}

export function GenericSection({
  spec, data, products = [], storeUrl = "",
}: {
  spec: LPSectionSpec;
  data: Data;
  /** Resolved product cards for `render: "products"` sections. */
  products?: LandingProductCard[];
  storeUrl?: string;
}) {
  if (isBlockEmpty(spec, data)) return null;

  if (spec.render === "before_after") {
    return (
      <BeforeAfter
        title={str(data.title)}
        text={str(data.text)}
        items={Array.isArray(data.items) ? data.items : []}
      />
    );
  }
  if (spec.render === "video") {
    return (
      <VideoEmbed
        title={str(data.title)}
        text={str(data.text)}
        videoUrl={str(data.videoUrl)}
        poster={str(data.poster)}
      />
    );
  }
  if (spec.render === "gallery") {
    return <Gallery title={str(data.title)} items={Array.isArray(data.items) ? data.items : []} />;
  }
  if (spec.render === "products") {
    return <ProductGrid title={str(data.title)} products={products} storeUrl={storeUrl} />;
  }


  const scalars = scalarFields(spec);
  const title = str(data[scalars.find((f) => /title|headline/i.test(f.key))?.key ?? ""]);
  const subtitle = str(data[scalars.find((f) => /subtitle|subheadline|intro|description|text/i.test(f.key))?.key ?? ""]);
  const heroImage = str(data[scalars.find((f) => f.type === "image")?.key ?? ""]);

  const rest = scalars.filter(
    (f) => str(data[f.key]) && str(data[f.key]) !== title && str(data[f.key]) !== subtitle && f.type !== "image",
  );

  const lists = listFields(spec);

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        {subtitle && (
          <p className="mx-auto mt-2 max-w-2xl whitespace-pre-line text-center text-sm leading-relaxed text-neutral-600">
            {subtitle}
          </p>
        )}

        {heroImage && (
          <img
            src={lpImage(heroImage)}
            alt={title || spec.name}
            loading="lazy"
            className="mx-auto mt-6 w-full max-w-3xl object-cover"
            style={{ borderRadius: "var(--lp-radius)" }}
          />
        )}

        {rest.length > 0 && (
          <div className="mx-auto mt-4 max-w-3xl space-y-2 text-center text-sm text-neutral-700">
            {rest.map((f) => (
              <p key={f.key} className="whitespace-pre-line">{str(data[f.key])}</p>
            ))}
          </div>
        )}

        {lists.map((lf) => {
          const items: Data[] = (Array.isArray(data[lf.key]) ? data[lf.key] : []).filter((it: Data) =>
            Object.values(it ?? {}).some((v) => str(v)),
          );
          if (!items.length) return null;
          const itemFields = lf.fields.filter((f) => f.type !== "list") as ScalarField[];
          return (
            <div key={lf.key} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it, i) => {
                const image = itemFields.find((f) => f.type === "image" && str(it[f.key]));
                // An "icon" field stores an icon NAME — resolve it to a real
                // icon and never print the raw name as text.
                const iconField = itemFields.find((f) => f.key === "icon" && str(it[f.key]));
                const Icon = iconField ? lpIcon(it[iconField.key]) : null;
                const texts = itemFields.filter(
                  (f) => f.type !== "image" && f.key !== "icon" && f.type !== "products" && str(it[f.key]),
                );
                const [head, ...body] = texts;
                return (
                  <div key={i} className="p-4" style={{ borderRadius: "var(--lp-radius)", background: "var(--lp-surface)" }}>
                    {image && (
                      <img
                        src={lpImage(str(it[image.key]))}
                        alt=""
                        loading="lazy"
                        className="mb-3 aspect-square w-full object-cover"
                        style={{ borderRadius: "calc(var(--lp-radius) / 1.5)" }}
                      />
                    )}
                    {Icon && !image && (
                      <Icon className="mb-2 h-5 w-5" style={{ color: "var(--lp-primary)" }} />
                    )}
                    {head && (
                      <div className="flex items-start gap-2">
                        {!image && !Icon && (
                          (() => { const Fallback = lpIcon("check"); return <Fallback className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--lp-primary)" }} />; })()
                        )}
                        <div className="font-semibold">{str(it[head.key])}</div>
                      </div>
                    )}
                    {body.map((f) => (
                      <p key={f.key} className="mt-1 whitespace-pre-line text-sm text-neutral-600">
                        {str(it[f.key])}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
