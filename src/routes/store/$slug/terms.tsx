import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/store/$slug/terms")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$slug/terms-conditions", params: { slug: params.slug } });
  },
});
