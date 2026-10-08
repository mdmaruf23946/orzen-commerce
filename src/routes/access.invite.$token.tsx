import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getInvite, respondInvite, switchStore } from "@/lib/delegated-access.functions";
import { setActiveStoreId } from "@/lib/active-store";

export const Route = createFileRoute("/access/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Review store access — ORZEN" },
      { name: "description", content: "Review and accept a Merchant Panel access invitation on ORZEN." },
      { property: "og:title", content: "Review store access — ORZEN" },
      { property: "og:description", content: "Review and accept a Merchant Panel access invitation on ORZEN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const fetchInvite = useServerFn(getInvite);
  const respond = useServerFn(respondInvite);
  const doSwitch = useServerFn(switchStore);
  const [state, setState] = useState<"loading" | "signin" | "ready">("loading");
  const [inv, setInv] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState("signin");
      try {
        setInv(await fetchInvite({ data: { token } }));
      } catch {
        setInv({ found: false });
      }
      setState("ready");
    })();
  }, [token]);

  async function act(accept: boolean) {
    setBusy(true);
    try {
      const r = await respond({ data: { token, accept } });
      if (accept && r.storeId) {
        toast.success("Access accepted");
        const s = await doSwitch({ data: { storeId: r.storeId } });
        setActiveStoreId(s.storeId);
        window.location.assign("/admin");
        return;
      }
      toast.success("Invitation declined");
      setInv({ ...inv, status: "declined" });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  const next = `/access/invite/${token}`;
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">Merchant Panel access</h1>
        </div>

        {state === "loading" && <div className="h-24 animate-pulse rounded-lg bg-muted/40" />}

        {state === "signin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">আমন্ত্রণটি দেখতে যে ইমেইলে আমন্ত্রণ এসেছে সেই অ্যাকাউন্ট দিয়ে লগইন করুন।</p>
            <Button asChild className="w-full">
              <a href={`/auth?next=${encodeURIComponent(next)}`}>Sign in to review</a>
            </Button>
          </div>
        )}

        {state === "ready" && inv && (
          !inv.found ? (
            <p className="text-sm text-muted-foreground">আমন্ত্রণটি পাওয়া যায়নি বা লিংকটি আর কার্যকর নয়।</p>
          ) : !inv.matches ? (
            <p className="text-sm text-muted-foreground">এই আমন্ত্রণ অন্য একটি ইমেইলের জন্য। সঠিক অ্যাকাউন্ট দিয়ে লগইন করুন।</p>
          ) : inv.status !== "pending" || inv.expired ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {inv.status === "accepted" ? "এই আমন্ত্রণ আগেই গ্রহণ করা হয়েছে।" : inv.status === "declined" ? "আমন্ত্রণটি প্রত্যাখ্যান করা হয়েছে।" : "এই আমন্ত্রণ আর কার্যকর নয়।"}
              </p>
              <Button asChild variant="outline" className="w-full"><Link to="/admin">Merchant Panel-এ যান</Link></Button>
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Store</dt><dd className="font-medium">{inv.storeName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Invited by</dt><dd>{inv.inviter}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Role</dt><dd>{inv.role}</dd></div>
                <div><dt className="text-muted-foreground">Permissions</dt><dd className="mt-1 text-xs">{inv.permissionSummary}</dd></div>
              </dl>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => act(true)}>Accept</Button>
                <Button className="flex-1" variant="outline" disabled={busy} onClick={() => act(false)}>Decline</Button>
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}
