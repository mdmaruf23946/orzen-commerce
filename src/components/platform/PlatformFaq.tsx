import { PLATFORM_FAQ } from "@/lib/platform-seo";

export function PlatformFaq() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
      <div className="mt-6 divide-y rounded-xl border bg-card">
        {PLATFORM_FAQ.map((f) => (
          <details key={f.q} className="group p-4">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
