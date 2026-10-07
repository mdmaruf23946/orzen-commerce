import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CalendarDays, KeyRound, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react";
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

  if (isLoading || !profile) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your personal Merchant Panel account and preferences.</p>
      </div>

      <section className="border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <AccountAvatar name={profile.name} avatarUrl={profile.avatarUrl} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{profile.name}</div>
            <div className="truncate text-sm text-muted-foreground">{profile.email}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.accountType}</Badge>
              <Badge variant={profile.emailVerified ? "default" : "outline"}>
                {profile.emailVerified ? "Email verified" : "Email not verified"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
        <form onSubmit={submit} className="space-y-5 border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4" /> Profile Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update the name and photo shown across your account.</p>
          </div>
          <div className="space-y-2">
            <Label>Profile picture</Label>
            <ImageUploader
              folder={profile.storeId ? `${profile.storeId}/profiles/${profile.id}` : undefined}
              value={avatarUrl}
              onChange={setAvatarUrl}
              accept="image/png,image/jpeg,image/webp"
              maxBytes={2 * 1024 * 1024}
              label="Upload photo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={profile.email} readOnly disabled />
            <p className="text-xs text-muted-foreground">Your sign-in email cannot be changed here.</p>
          </div>
          <Button type="submit" disabled={saving || name.trim().length < 2}>{saving ? "Saving…" : "Save profile"}</Button>
        </form>

        <div className="space-y-5">
          <section className="border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
            <h2 className="font-semibold">Basic account information</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Account type</dt><dd className="text-right font-medium">{profile.accountType}</dd></div>
              {profile.role && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Role</dt><dd className="text-right font-medium capitalize">{profile.role.replaceAll("_", " ")}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Joined</dt><dd className="text-right font-medium">{formatDate(profile.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Last sign-in</dt><dd className="text-right font-medium">{formatDate(profile.lastSignInAt)}</dd></div>
              <div className="space-y-1"><dt className="text-muted-foreground">Account ID</dt><dd className="break-all font-mono text-xs">{profile.id}</dd></div>
            </dl>
          </section>

          <section className="border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">Account verification / KYC</h2>
                <p className="mt-1 text-sm text-muted-foreground">Verification will be available here in a future update.</p>
                <Badge variant="outline" className="mt-3">Coming soon</Badge>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
        <h2 className="font-semibold">Account tools</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/admin/settings/security" className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted"><ShieldCheck className="h-4 w-4 text-primary" /> Security settings</Link>
          <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground"><KeyRound className="h-4 w-4" /> API access · Future</div>
          <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground"><Palette className="h-4 w-4" /> Personalization · Future</div>
          <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> Account settings · Future</div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
        <div>
          <h2 className="text-sm font-semibold">Sign out of ORZEN</h2>
          <p className="text-xs text-muted-foreground">This ends your session on this device.</p>
        </div>
        <Button type="button" variant="destructive" onClick={signOut}><LogOut className="h-4 w-4" /> Logout</Button>
      </section>
    </div>
  );
}