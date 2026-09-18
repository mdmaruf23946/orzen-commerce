import { useState, type ReactNode } from "react";
import { ShieldAlert, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerifyEmailDialog } from "@/components/admin/VerifyEmailDialog";
import { useSecurityStatus, isSensitivePath } from "@/lib/use-security";

/** Small banner shown on every merchant page until the email is verified. */
export function EmailVerifyBanner() {
  const { data } = useSecurityStatus();
  const [open, setOpen] = useState(false);
  if (!data || data.emailVerified) return null;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <span className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 shrink-0" />
          আপনার ইমেইলটি এখনো ভেরিফাই করা হয়নি — অ্যাকাউন্ট সুরক্ষিত রাখতে এখনই করে নিন।
        </span>
        <Button size="sm" variant="outline" className="h-7 bg-white/70" onClick={() => setOpen(true)}>
          Verify email
        </Button>
      </div>
      <VerifyEmailDialog open={open} onOpenChange={setOpen} email={data.email} />
    </>
  );
}

/** Blocks sensitive panel areas until the account email is verified. */
export function EmailVerifyGate({ path, children }: { path: string; children: ReactNode }) {
  const { data, isLoading } = useSecurityStatus();
  const [open, setOpen] = useState(false);

  if (!isSensitivePath(path)) return <>{children}</>;
  if (isLoading || !data || data.emailVerified) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">ইমেইল ভেরিফিকেশন প্রয়োজন</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        এই অংশটি আপনার ব্যবসার সংবেদনশীল তথ্য নিয়ে কাজ করে। একবার ইমেইল ভেরিফাই করলেই পুরো
        অ্যাকাউন্ট খুলে যাবে — আর কখনো চাইবে না।
      </p>
      <Button className="mt-6" onClick={() => setOpen(true)}>
        Verify my email
      </Button>
      <VerifyEmailDialog open={open} onOpenChange={setOpen} email={data.email} />
    </div>
  );
}
