import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, MailCheck, KeyRound, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerifyEmailDialog } from "@/components/admin/VerifyEmailDialog";
import { useSecurityStatus, useRefreshSecurity } from "@/lib/use-security";
import { syncTotpStatus, regenerateBackupCodes } from "@/lib/merchant-security.functions";

export const Route = createFileRoute("/_authenticated/admin/settings/security")({
  head: () => ({
    meta: [
      { title: "Account security — ORZEN" },
      { name: "description", content: "Verify your email and turn on two-factor authentication." },
    ],
  }),
  component: SecuritySettings,
});

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-sm">{children}</div>;
}

function SecuritySettings() {
  const { data, isLoading } = useSecurityStatus();
  const refresh = useRefreshSecurity();
  const sync = useServerFn(syncTotpStatus);
  const regen = useServerFn(regenerateBackupCodes);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function startEnroll() {
    setBusy(true);
    try {
      // Clean up any half-finished factor from a previous attempt.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: res, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `ORZEN ${Date.now()}`,
      });
      if (error) throw error;
      setEnroll({
        factorId: res.id,
        qr: res.totp.qr_code,
        secret: res.totp.secret,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enroll.factorId,
        code,
      });
      if (error) throw error;
      const res = (await sync()) as { backupCodes: string[] | null };
      setBackupCodes(res?.backupCodes ?? null);
      setEnroll(null);
      setCode("");
      refresh();
      toast.success("Two-factor authentication is on");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa() {
    setBusy(true);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
      await sync();
      setBackupCodes(null);
      refresh();
      toast.success("Two-factor authentication turned off");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function newBackupCodes() {
    setBusy(true);
    try {
      const res = (await regen()) as { codes: string[] };
      setBackupCodes(res.codes);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MailCheck className="h-4 w-4" /> Email verification
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.email ?? "—"} —{" "}
              {data.emailVerified ? (
                <span className="font-medium text-green-700 dark:text-green-300">Verified</span>
              ) : (
                <span className="font-medium text-amber-700 dark:text-amber-300">Not verified</span>
              )}
            </p>
            {!data.emailVerified && (
              <p className="mt-2 max-w-md text-xs text-muted-foreground">
                একবার ভেরিফাই করলেই পুরো অ্যাকাউন্ট খুলে যাবে — পেমেন্ট, ডোমেইন, স্টাফ, প্ল্যান সব
                কিছু।
              </p>
            )}
          </div>
          {!data.emailVerified && <Button onClick={() => setVerifyOpen(true)}>Verify now</Button>}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4" /> Two-factor authentication
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Google Authenticator বা Authy অ্যাপ দিয়ে প্রতিবার লগইনে একটি ৬ ডিজিট কোড চাইবে —
              পাসওয়ার্ড চুরি হলেও কেউ ঢুকতে পারবে না।
            </p>
          </div>
          {data.totpEnabled ? (
            <Button variant="outline" onClick={disable2fa} disabled={busy}>
              Turn off
            </Button>
          ) : (
            !enroll && (
              <Button onClick={startEnroll} disabled={busy}>
                <Smartphone className="mr-1.5 h-4 w-4" /> Enable
              </Button>
            )
          )}
        </div>

        {enroll && (
          <div className="mt-5 space-y-4 border-t pt-5">
            <p className="text-sm">
              1. Google Authenticator খুলে নিচের QR কোডটি স্ক্যান করুন।
            </p>
            <div
              className="mx-auto w-40 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: enroll.qr }}
            />
            <p className="break-all text-center text-xs text-muted-foreground">
              Manual key: <span className="font-mono">{enroll.secret}</span>
            </p>
            <form className="mx-auto max-w-xs space-y-3" onSubmit={confirmEnroll}>
              <Label htmlFor="totp">2. অ্যাপের ৬ ডিজিট কোডটি লিখুন</Label>
              <Input
                id="totp"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.4em]"
              />
              <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                {busy ? "Checking…" : "Turn on two-factor"}
              </Button>
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEnroll(null)}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {data.totpEnabled && (
          <div className="mt-5 border-t pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4" /> Backup codes
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              ফোন হারালে এই কোডগুলোর একটি দিয়ে অ্যাকাউন্টে ঢুকতে পারবেন। বাকি আছে:{" "}
              {data.backupCodesLeft}
            </p>
            {backupCodes && (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-3 font-mono text-sm">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={newBackupCodes} disabled={busy}>
              Generate new codes
            </Button>
          </div>
        )}
      </Card>

      <VerifyEmailDialog open={verifyOpen} onOpenChange={setVerifyOpen} email={data.email} />
    </div>
  );
}
