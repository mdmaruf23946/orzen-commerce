import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkStoreSlugAvailable, createMyStoreWithSlug, getMyStore } from "@/lib/admin.functions";
import { myAccountKind } from "@/lib/employees.functions";

import { CheckCircle2, XCircle, Loader2, AlertCircle, UserCog } from "lucide-react";
import { BrandMark } from "@/lib/platform-branding";
import { isInvalidAuthSessionError } from "@/lib/deployment-target";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your store — ORZEN" },
      {
        name: "description",
        content:
          "Sign in to your ORZEN dashboard or create a free account to launch your online store with AI sales, courier delivery and secure payments.",
      },
      { property: "og:title", content: "Sign in or create your store — ORZEN" },
      {
        property: "og:description",
        content:
          "Access your ORZEN dashboard or start a new online store in minutes — no coding required.",
      },
      { property: "og:url", content: "https://orzen.top/auth" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://orzen.top/auth" }],
  }),
  component: AuthPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type SlugStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

function AuthPage() {
  const navigate = useNavigate();
  const ensureMyStore = useServerFn(getMyStore);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");

  // Safe next redirect: same-origin relative path only.
  function getNext(): string {
    if (typeof window === "undefined") return "/admin";
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw) return "/admin";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/admin";
    return raw;
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: getNext(), replace: true });
    });
  }, [navigate]);

  // auto-suggest slug from store name
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(storeName));
  }, [storeName, slugTouched]);

  // debounced availability check
  const reqIdRef = useRef(0);
  useEffect(() => {
    if (mode !== "signup") return;
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (slug.length < 3 || !SLUG_RE.test(slug)) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const id = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        const res = await checkStoreSlugAvailable({ data: { slug } });
        if (id !== reqIdRef.current) return;
        setSlugStatus(res.available ? "available" : "taken");
      } catch {
        if (id !== reqIdRef.current) return;
        setSlugStatus("error");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug, mode]);

  const passwordsMatch = password.length >= 6 && password === confirmPassword;
  const canSubmitSignup =
    ownerName.trim().length >= 2 &&
    storeName.trim().length >= 2 &&
    slugStatus === "available" &&
    email.includes("@") &&
    passwordsMatch;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const next = getNext();
      if (mode === "forgot") {
        if (!email.includes("@")) throw new Error("Please enter the email address of your account.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Password reset link sent. Please check your email inbox and spam folder.");
        setLoading(false);
        return;
      }
      if (mode === "signup") {
        if (!canSubmitSignup) throw new Error("Please complete the form correctly.");
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: { owner_name: ownerName, store_name: storeName, store_slug: slug },
          },
        });
        if (error) throw error;
        // Without a session the store cannot be created yet (email confirmation on).
        if (!signUpData.session) {
          throw new Error(
            "Account created. Please confirm your email, then sign in — your store will be set up automatically.",
          );
        }
        await createMyStoreWithSlug({
          data: { storeName: storeName.trim(), slug, ownerName: ownerName.trim() },
        });
        toast.success("Store created. Welcome!");

      } else {
        // A previous deployment may have left a session for another backend.
        // Clear only this browser's cached session before issuing a fresh token.
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw error;
        const kind = (await myAccountKind()) as any;
        if (kind?.kind === "employee") {
          await supabase.auth.signOut();
          throw new Error(
            "This is an employee account. Please sign in from the Employee login page (/employee-login).",
          );
        }
        // Email-confirmed merchants may not have completed store creation yet.
        // Complete it before entering the panel so child pages never race it.
        await ensureMyStore();

      }
      navigate({ to: next, replace: true });
    } catch (err) {
      if (isInvalidAuthSessionError(err)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        toast.error("Your sign-in session could not be verified. Please sign in again.");
      } else {
        toast.error((err as Error).message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const rootDomain = "orzen.top";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div
        className={`w-full ${mode === "signup" ? "max-w-md" : "max-w-sm"} rounded-2xl border bg-card p-5 sm:p-6 shadow-sm`}
      >
        <Link to="/" className="flex items-center justify-center">
          <BrandMark
            placement={mode === "signup" ? "auth_register" : "auth_login"}
            fallbackText="ORZEN"
            className="text-sm font-bold tracking-tight"
          />
        </Link>
        <h1 className="mt-3 text-center text-lg sm:text-xl font-semibold">
          {mode === "signin"
            ? "Sign in to your store"
            : mode === "forgot"
              ? "Reset your password"
              : "Create your store"}
        </h1>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <Field label="Owner name" id="owner">
                <Input
                  id="owner"
                  autoComplete="name"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </Field>
              <Field label="Store name" id="store">
                <Input
                  id="store"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </Field>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Store subdomain</Label>
                <div className="flex items-stretch rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    id="slug"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                          .slice(0, 40),
                      );
                    }}
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="my-store"
                  />
                  <span className="flex items-center px-2 text-xs text-muted-foreground border-l">
                    .{rootDomain}
                  </span>
                </div>
                <SlugStatusPill status={slugStatus} slug={slug} />
              </div>
              <Field label="Email" id="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" id="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirm password" id="confirm">
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </Field>
            </>
          )}

          {mode === "signin" && (
            <>
              <Field label="Email" id="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" id="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setMode("forgot");
                }}
                className="w-full text-right text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot your password?
              </button>
            </>
          )}

          {mode === "forgot" && (
            <>
              <p className="text-sm text-muted-foreground">
                Enter your account email. We will send you a link to set a new password.
              </p>
              <Field label="Email" id="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {resetSent && (
                <p className="text-xs text-emerald-600">
                  Reset link sent. Please check your inbox and spam folder.
                </p>
              )}
            </>
          )}

          <Button
            type="submit"
            className="w-full h-10 mt-1"
            disabled={loading || (mode === "signup" && !canSubmitSignup)}
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Create store"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setResetSent(false);
            setMode((m) => (m === "signin" ? "signup" : "signin"));
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "New here? Create your store" : "Have an account? Sign in"}
        </button>


        {mode === "signin" && (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button asChild variant="outline" className="h-10 w-full">
              <Link to="/employee-login">
                <UserCog className="mr-2 h-4 w-4" />
                Employee login
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SlugStatusPill({ status, slug }: { status: SlugStatus; slug: string }) {
  if (!slug) return <p className="text-xs text-muted-foreground">3–40 chars: lowercase, numbers, hyphens.</p>;
  const map: Record<SlugStatus, { icon: React.ReactNode; text: string; cls: string }> = {
    idle: { icon: null, text: "", cls: "text-muted-foreground" },
    invalid: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: "Invalid format — use lowercase, numbers, hyphens.",
      cls: "text-amber-600",
    },
    checking: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "Checking availability…",
      cls: "text-muted-foreground",
    },
    available: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: "Available",
      cls: "text-emerald-600",
    },
    taken: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      text: "Already taken",
      cls: "text-destructive",
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: "Could not check — try again.",
      cls: "text-amber-600",
    },
  };
  const it = map[status];
  return (
    <p className={`flex items-center gap-1.5 text-xs ${it.cls}`}>
      {it.icon}
      <span>{it.text}</span>
    </p>
  );
}
