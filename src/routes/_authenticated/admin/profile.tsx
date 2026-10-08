import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BadgeCheck, CalendarDays, Copy, Fingerprint, Info, Lock, LogIn, LogOut, Mail, ShieldCheck, UserRound,
} from "lucide-react";
import { AccountAvatar } from "@/components/admin/AccountAvatar";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getAccountProfile, updateAccountProfile } from "@/lib/account-profile.functions";
import { useStoreAccess } from "@/lib/use-store-access";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ORZEN Merchant Panel" },
      { name: "description", content: "Manage your ORZEN Merchant Panel account profile." },
      { property: "og:title", content: "Profile — ORZEN Merchant Panel" },
      { property: "og:description", content: "Manage your ORZEN Merchant Panel account profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function SectionCard({ icon, title, description, children, footer }: {
  icon: ReactNode; title: string; description?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="border-t bg-muted/40 px-5 py-3">{footer}</div>}
    </section>
  );
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useStoreAccess();
  const load = useServerFn(getAccountProfile);
  const save = useServerFn(updateAccountProfile);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin", "account-profile"],
    queryFn: () => load(),
  });
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setAvatarUrl(profile.avatarUrl);
  }, [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await save({ data: { name, avatarUrl } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "account-profile"] });
      toast.success("Profile updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: access.isEmployee ? "/employee-login" : "/auth", replace: true });
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Account ID copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  if (isLoading || !profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const roleLabel = profile.role ? profile.role.replaceAll("_", " ") : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal account details and preferences.</p>
      </div>

      {/* Header */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-accent sm:h-24" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
          <AccountAvatar
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            className="-mt-10 h-20 w-20 border-4 border-card shadow-md ring-1 ring-border sm:-mt-12 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold">{profile.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />{profile.email}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" />{profile.accountType}</Badge>
              <Badge variant={profile.emailVerified ? "default" : "outline"} className="gap-1">
                <BadgeCheck className="h-3 w-3" />{profile.emailVerified ? "Email verified" : "Email not verified"}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />Active
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <form onSubmit={submit}>
          <SectionCard
            icon={<UserRound className="h-4 w-4" />}
            title="Profile Settings"
            description="Update the name and photo shown across your account."
            footer={
              <div className="flex justify-end">
                <Button type="submit" className="w-full sm:w-auto" disabled={saving || name.trim().length < 2}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Profile photo</Label>
                <ImageUploader
                  folder={profile.storeId ? `${profile.storeId}/profiles/${profile.id}` : undefined}
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  accept="image/png,image/jpeg,image/webp"
                  maxBytes={2 * 1024 * 1024}
                  label="Upload photo"
                />
                <p className="text-xs text-muted-foreground">PNG, JPG or WEBP, up to 2MB.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-email">Email address</Label>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Read-only</span>
                </div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="profile-email" className="h-11 cursor-not-allowed bg-muted pl-9" value={profile.email} readOnly disabled />
                </div>
                <p className="text-xs text-muted-foreground">Your sign-in email cannot be changed here.</p>
              </div>
            </div>
          </SectionCard>
        </form>

        <SectionCard icon={<Info className="h-4 w-4" />} title="Account information" description="Basic details about your account.">
          <dl className="divide-y">
            <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Account type">{profile.accountType}</InfoRow>
            {roleLabel && <InfoRow icon={<UserRound className="h-4 w-4" />} label="Role"><span className="capitalize">{roleLabel}</span></InfoRow>}
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Joined">{formatDate(profile.createdAt)}</InfoRow>
            <InfoRow icon={<LogIn className="h-4 w-4" />} label="Last sign-in">{formatDate(profile.lastSignInAt)}</InfoRow>
            <div className="space-y-2 pt-3">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Fingerprint className="h-4 w-4" />Account ID</dt>
              <dd className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <span className="min-w-0 flex-1 break-all font-mono text-xs">{profile.id}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyId(profile.id)} aria-label="Copy account ID">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sign out of ORZEN</h2>
          <p className="text-xs text-muted-foreground">This ends your session on this device.</p>
        </div>
        <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </section>
    </div>
  );
}
