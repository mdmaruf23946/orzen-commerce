import { createFileRoute, Navigate, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  component: SplatRedirect,
});

function SplatRedirect() {
  const loc = useLocation();
  // Strip a stray "_authenticated/" prefix if the user typed/pasted the
  // internal layout segment into the URL bar.
  if (loc.pathname.startsWith("/_authenticated/")) {
    const fixed = loc.pathname.replace("/_authenticated", "");
    return <Navigate to={fixed + (loc.searchStr ?? "")} replace />;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
