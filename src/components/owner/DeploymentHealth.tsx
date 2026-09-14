// Owner-only "is this host configured?" strip.
// Shows presence of required server keys — names only, never values.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { deploymentHealth } from "@/lib/ai-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Row({ label, ok, hint }: { label: string; ok: boolean; hint?: string | null }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
      )}
      <div className="min-w-0">
        <span className="font-medium">{label}</span>
        {!ok && hint ? <div className="text-xs text-muted-foreground break-words">{hint}</div> : null}
      </div>
    </div>
  );
}

export function DeploymentHealth({ className }: { className?: string }) {
  const fn = useServerFn(deploymentHealth);
  const { data } = useQuery({
    queryKey: ["ai-admin", "deployment-health"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const host = typeof window !== "undefined" ? window.location.host : "";
  const missing = (data?.keys ?? []).filter((k: any) => !k.present).map((k: any) => k.name);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Deployment health
          {data ? (
            <Badge variant={data.ok ? "default" : "destructive"} className="ml-auto">
              {data.ok ? "Ready" : "Needs setup"}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Checks for the address you are on right now{host ? ` (${host})` : ""}.
        </p>
        <Row label="Database access" ok={Boolean(data?.database)} hint={data?.databaseError} />
        <Row
          label="Credential decryption"
          ok={Boolean(data?.credentials)}
          hint={data?.credentialsError}
        />
        <Row label="AI service key" ok={Boolean(data?.ai)} hint="LOVABLE_API_KEY is not available here." />
        {missing.length > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              Missing on this host: <b>{missing.join(", ")}</b>. Add them in your hosting project
              (Cloudflare Pages → Settings → Variables and Secrets) for Production and Preview, then
              redeploy once. Use the same encryption key value as the Lovable deployment.
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
