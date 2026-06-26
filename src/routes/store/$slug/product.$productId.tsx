import { createFileRoute, useNavigate, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { getProduct, getStoreBySlug } from "@/lib/storefront.functions";
import { addToCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

const productQuery = (storeId: string, productId: string) =>
  queryOptions({
    queryKey: ["product", storeId, productId],
    queryFn: () => getProduct({ data: { storeId, productId } }),
  });

export const Route = createFileRoute("/store/$slug/product/$productId")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    const product = await context.queryClient.ensureQueryData(productQuery(store.id, params.productId));
    if (!product) throw notFound();
    return { store, product };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.product.name} — ${loaderData.store.name}` },
            { name: "description", content: loaderData.product.description ?? loaderData.product.name },
          ],
        }
      : {},
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Product not found</div>,
  component: ProductPage,
});

function ProductPage() {
  const { slug, productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const { data: product } = useSuspenseQuery(productQuery(store!.id, productId));
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(product!.primary_image_url ?? product!.gallery[0] ?? null);

  if (!product) return null;
  const inStock = product.stock > 0 && product.status !== "draft";
  const gallery = [product.primary_image_url, ...product.gallery].filter(Boolean) as string[];

  function add() {
    addToCart(slug, {
      productId: product!.id,
      name: product!.name,
      price: Number(product!.price),
      image: product!.primary_image_url,
      qty,
    });
    toast.success("Added to cart");
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
          {activeImg ? (
            <img src={activeImg} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>
          )}
        </div>
        {gallery.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {gallery.map((g) => (
              <button
                key={g}
                onClick={() => setActiveImg(g)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border ${activeImg === g ? "ring-2 ring-primary" : ""}`}
              >
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{product.name}</h1>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl font-bold" style={{ color: "var(--primary)" }}>
            ৳{Number(product.price).toFixed(0)}
          </span>
          {product.old_price && (
            <span className="text-sm text-muted-foreground line-through">
              ৳{Number(product.old_price).toFixed(0)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm">
          {inStock ? (
            <span className="text-emerald-600">In stock ({product.stock})</span>
          ) : (
            <span className="text-destructive">Out of stock</span>
          )}
        </p>
        {product.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>
        )}

        <div className="mt-6 inline-flex items-center rounded-full border">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center"
            onClick={() => setQty((q) => Math.min(product!.stock, q + 1))}
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!inStock}
            onClick={add}
            className="h-12"
          >
            Add to Cart
          </Button>
          <Button
            type="button"
            disabled={!inStock}
            onClick={() => {
              add();
              navigate({ to: "/store/$slug/checkout", params: { slug } });
            }}
            className="h-12"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            Buy Now
          </Button>
        </div>

        <Link
          to="/store/$slug"
          params={{ slug }}
          className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to store
        </Link>
      </div>
    </div>
  );
}
