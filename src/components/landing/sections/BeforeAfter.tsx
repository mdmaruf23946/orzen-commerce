// Before & After comparison pairs. Design is system-owned.
import { lpImage } from "@/lib/landing-builder";

type Item = Record<string, any>;

export function BeforeAfter({
  title, text, items,
}: {
  title: string;
  text: string;
  items: Item[];
}) {
  const pairs = items.filter((it) => String(it?.beforeImage ?? "") || String(it?.afterImage ?? ""));
  if (!pairs.length) return null;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        {text && (
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-neutral-600">{text}</p>
        )}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {pairs.map((it, i) => (
            <figure key={i} className="overflow-hidden bg-neutral-50 p-3" style={{ borderRadius: "var(--lp-radius)" }}>
              <div className="grid grid-cols-2 gap-2">
                {(["before", "after"] as const).map((side) => {
                  const src = String(it[`${side}Image`] ?? "");
                  const label = String(it[`${side}Label`] ?? "") || (side === "before" ? "Before" : "After");
                  return (
                    <div key={side} className="relative">
                      {src ? (
                        <img
                          src={lpImage(src)}
                          alt={label}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                          style={{ borderRadius: "calc(var(--lp-radius) / 1.5)" }}
                        />
                      ) : (
                        <div
                          className="aspect-square w-full bg-neutral-200"
                          style={{ borderRadius: "calc(var(--lp-radius) / 1.5)" }}
                        />
                      )}
                      <span className="absolute left-2 top-2 bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {String(it.label ?? "") && (
                <figcaption className="mt-3 text-center text-sm font-medium text-neutral-700">
                  {String(it.label)}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
