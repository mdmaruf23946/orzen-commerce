import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/store/$slug/refund-policy")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$slug/return-refund-policy", params: { slug: params.slug } });
  },
});
