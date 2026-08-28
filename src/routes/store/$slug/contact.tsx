import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/store/$slug/contact")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$slug/contact-us", params: { slug: params.slug } });
  },
});
