/** Static, instantly-rendered placeholder that mirrors the storefront home
 * layout (banner, category tiles, product grids) so the page never collapses
 * to an empty body while data is being fetched. */
function Box({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-neutral-200/70 ${className}`} />;
}

function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-2xl border border-sf-line bg-white p-2">
          <Box className="aspect-square w-full" />
          <Box className="h-3 w-11/12 rounded-md" />
          <Box className="h-3 w-2/3 rounded-md" />
          <Box className="h-8 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:gap-8" aria-busy="true" aria-hidden>
      {/* Banner */}
      <Box className="aspect-[16/7] w-full rounded-3xl sm:aspect-[21/8]" />

      {/* Category tiles */}
      <section className="rounded-2xl border border-sf-line bg-white p-2 sm:rounded-3xl sm:p-4">
        <div className="flex flex-nowrap gap-2 sm:grid sm:grid-cols-6 sm:gap-4 md:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-[calc(25%-0.5rem)] shrink-0 space-y-1 sm:w-auto"
            >
              <Box className="aspect-square w-full" />
              <Box className="mx-auto h-2.5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      {/* Featured carousel */}
      <section className="sf-featured-panel overflow-hidden rounded-3xl p-3 shadow-lg sm:p-6">
        <Box className="mx-auto mb-4 h-5 w-48 rounded-md bg-white/40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-white/80 p-2">
              <Box className="aspect-square w-full" />
              <Box className="h-3 w-10/12 rounded-md" />
              <Box className="h-3 w-1/2 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      {/* Product sections */}
      {[0, 1].map((s) => (
        <section key={s} className="space-y-3 sm:space-y-4">
          <Box className="h-5 w-40 rounded-md" />
          <ProductGridSkeleton count={5} />
        </section>
      ))}

      <section className="space-y-4">
        <Box className="h-5 w-36 rounded-md" />
        <ProductGridSkeleton count={10} />
      </section>
    </div>
  );
}

export default HomeSkeleton;
