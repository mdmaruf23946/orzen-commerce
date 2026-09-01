// Renders any non-builtin landing-page section from the registry schema.
// The design is system-owned: merchants only supply text and images.

import { Check } from "lucide-react";
import type { LPFieldSpec, LPSectionSpec } from "@/lib/landing-sections";
import { lpImage } from "@/lib/landing-builder";

type Data = Record<string, any>;

function scalarFields(spec: LPSectionSpec) {
  return spec.fields.filter((f) => f.type !== "list") as Exclude<LPFieldSpec, { type: "list" }>[];
}
function listFields(spec: LPSectionSpec) {
  return spec.fields.filter((f) => f.type === "list") as Extract<LPFieldSpec, { type: "list" }>[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/** True when the merchant/AI left the whole section empty. */
export function isBlockEmpty(spec: LPSectionSpec, data: Data): boolean {
  const hasScalar = scalarFields(spec).some((f) => str(data[f.key]));
  const hasList = listFields(spec).some(
    (f) => Array.isArray(data[f.key]) && data[f.key].some((it: Data) => Object.values(it ?? {}).some((v) => str(v))),
  );
  return !hasScalar && !hasList;
}

export function GenericSection({ spec, data }: { spec: LPSectionSpec; data: Data }) {
  if (isBlockEmpty(spec, data)) return null;

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
          const itemFields = lf.fields.filter((f) => f.type !== "list") as Exclude<LPFieldSpec, { type: "list" }>[];
          return (
            <div key={lf.key} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it, i) => {
                const image = itemFields.find((f) => f.type === "image" && str(it[f.key]));
                const texts = itemFields.filter((f) => f.type !== "image" && str(it[f.key]));
                const [head, ...body] = texts;
                return (
                  <div key={i} className="bg-neutral-50 p-4" style={{ borderRadius: "var(--lp-radius)" }}>
                    {image && (
                      <img
                        src={lpImage(str(it[image.key]))}
                        alt=""
                        loading="lazy"
                        className="mb-3 aspect-square w-full object-cover"
                        style={{ borderRadius: "calc(var(--lp-radius) / 1.5)" }}
                      />
                    )}
                    {head && (
                      <div className="flex items-start gap-2">
                        {!image && <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--lp-primary)" }} />}
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
