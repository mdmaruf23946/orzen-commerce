// Owner Panel card: GitHub connection guide + live deployment status.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Github, RefreshCw, Rocket, XCircle } from "lucide-react";
import { liveDeploymentStatus } from "@/lib/github-deploy.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  "এই Lovable এডিটরের চ্যাট বক্সের বাম পাশে (+) মেনু খুলুন।",
  "GitHub → Connect project-এ ক্লিক করে আপনার GitHub অ্যাকাউন্ট অনুমতি দিন।",
  "রিপোজিটরি তৈরি হলে চ্যাটে লিখুন: “GitHub কানেক্ট হয়েছে, ডিপলয় করে দাও”।",
  "আমি (Lovable) সাথে সাথে যাচাই করে orzen.top-এ ডিপলয় করে দেব।",
];

export function GitHubDeployment({ className }: { className?: string }) {
  const fn = useServerFn(liveDeploymentStatus);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["owner", "live-deployment"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);

  const live = Boolean(data?.reachable);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Github className="h-4 w-4" />
          GitHub &amp; Deployment
          {data ? (
            <Badge variant={live ? "default" : "destructive"} className="ml-auto">
              {live ? "Live" : "Unreachable"}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 text-sm">
          {live ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <span className="font-medium">orzen.top {live ? "is live" : "is not responding"}</span>
            {live && data?.bootedAt ? (
              <div className="text-xs text-muted-foreground">
                Current version running since {new Date(data.bootedAt).toLocaleString()}
              </div>
            ) : null}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-7 w-7 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Github className="mr-1.5 h-4 w-4" /> Connect GitHub
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Rocket className="mr-1.5 h-4 w-4" /> How deploy works
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          GitHub থেকে সরাসরি অটো-ডিপলয়ের সেটআপ Cloudflare অ্যাকাউন্টে GitHub অনুমতি চায় — ওটা
          একবারের কাজ, আমি ধাপে ধাপে করিয়ে দেব। সংযোগের পর প্রতিবার “deploy করো” লিখলেই লাইভ হয়ে
          যাবে।
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" /> GitHub সংযোগ ও ডিপলয়
            </DialogTitle>
            <DialogDescription>মাত্র একবারের সংযোগ — এরপর ডিপলয় এক ক্লিকের কাজ।</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            মনে রাখবেন: orzen.top কখনোই Lovable-এর Publish বাটন দিয়ে ডিপলয় হয় না — ডিপলয় সবসময়
            যাচাইকৃত নিরাপদ পথে (Cloudflare) হয়, যাতে লাইভ সাইট কখনো ভেঙে না যায়।
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
