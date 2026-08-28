import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/store/$slug/about")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$slug/about-us", params: { slug: params.slug } });
  },
});
