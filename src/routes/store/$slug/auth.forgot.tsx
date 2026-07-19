import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/store/$slug/auth/forgot")({
  head: () => ({ meta: [{ title: "Forgot password" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const { slug } = Route.useParams();
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-center text-lg font-semibold sm:text-xl">Forgot password</h1>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Please contact the store to reset your password. Our team can help you regain access to
          your account.
        </p>
        <Link
          to="/store/$slug/auth/login"
          params={{ slug }}
          className="mt-6 block text-center text-sm font-semibold text-foreground hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
