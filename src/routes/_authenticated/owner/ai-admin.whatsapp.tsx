import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Plug, RefreshCw, Send, XCircle } from "lucide-react";
import {
  getAiAdminConnection,
  saveAiAdminConnection,
  verifyAiAdminConnection,
  testAiAdminConnection,
  disconnectAiAdmin,
  generateAiAdminVerifyToken,
} from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/whatsapp")({ component: Page });

function Page() {
  const get = useServerFn(getAiAdminConnection);
  const save = useServerFn(saveAiAdminConnection);
  const verify = useServerFn(verifyAiAdminConnection);
  const test = useServerFn(testAiAdminConnection);
  const disconnect = useServerFn(disconnectAiAdmin);
  const generateToken = useServerFn(generateAiAdminVerifyToken);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-admin", "connection"], queryFn: () => get() });

  const [form, setForm] = useState({
    phone_number_id: "",
    waba_id: "",
    access_token: "",
    app_secret: "",
    verify_token: "",
  });
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm((f) => ({
      ...f,
      phone_number_id: data.phone_number_id ?? "",
      waba_id: data.waba_id ?? "",
      verify_token: data.verify_token ?? "",
    }));
  }, [data]);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/ai-admin/webhook` : "/api/public/ai-admin/webhook";
  const connected = data?.status === "connected";

  async function run(key: string, fn: () => Promise<any>, ok: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.ok === false) throw new Error(res.error || "Failed");
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["ai-admin"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <OwnerPageHeader
        title="WhatsApp Connection"
        description="Connect the WhatsApp Business account the AI Admin assistant replies from."
      />

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={connected ? "default" : "secondary"} className="gap-1">
            {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {connected ? "Connected" : data?.status === "error" ? "Error" : "Not connected"}
          </Badge>
          {data?.display_number ? <span className="text-sm">Connected number: <b>{data.display_number}</b></span> : null}
          {data?.credentials_hint ? (
            <span className="text-xs text-muted-foreground">Access token on file: {data.credentials_hint}</span>
          ) : null}
          {data?.last_error ? <span className="text-xs text-destructive">{data.last_error}</span> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Credentials</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Phone Number ID</Label>
              <Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp Business Account ID</Label>
              <Input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} />
            </div>
            <div>
              <Label>Access Token</Label>
              <Input
                type="password"
                placeholder={data?.credentials_hint ? "Leave blank to keep the saved token" : ""}
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Stored encrypted and never shown again.</p>
            </div>
            <div>
              <Label>App Secret (for webhook signature)</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep the saved secret"
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              />
            </div>
            <div>
              <Label>Verify Token</Label>
              <div className="flex gap-2">
                <Input value={form.verify_token} onChange={(e) => setForm({ ...form, verify_token: e.target.value })} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy === "gen"}
                  onClick={async () => {
                    setBusy("gen");
                    try {
                      const res = await generateToken();
                      setForm((f) => ({ ...f, verify_token: res.verify_token }));
                      qc.invalidateQueries({ queryKey: ["ai-admin"] });
                      toast.success("New verify token generated and saved");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <RefreshCw className="mr-1 h-4 w-4" /> Generate
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate creates and saves a new token instantly — paste this exact token in your Meta app's webhook
                settings.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                disabled={busy === "save"}
                onClick={() => run("save", () => save({ data: form }), "Credentials saved")}
              >
                Save
              </Button>
              <Button
                variant="outline"
                disabled={busy === "verify"}
                onClick={() => run("verify", () => verify(), "Connection verified")}
              >
                <Plug className="mr-1 h-4 w-4" /> Verify Connection
              </Button>
              {connected ? (
                <Button
                  variant="destructive"
                  disabled={busy === "dc"}
                  onClick={() => run("dc", () => disconnect(), "Disconnected")}
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Webhook configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this URL and your Verify Token into the WhatsApp product webhook settings of your Meta app, then
                subscribe to the <b>messages</b> field.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Test connection</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Send a test message to</Label>
                <Input placeholder="8801XXXXXXXXX" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </div>
              <Button
                variant="outline"
                disabled={!testTo || busy === "test"}
                onClick={() => run("test", () => test({ data: { to: testTo } }), "Test message sent")}
              >
                <Send className="mr-1 h-4 w-4" /> Test Connection
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
