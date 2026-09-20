import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Plug, RefreshCw, Send, XCircle } from "lucide-react";
import {
  getAiAdminMessenger,
  saveAiAdminMessenger,
  verifyAiAdminMessenger,
  testAiAdminMessenger,
  disconnectAiAdminMessenger,
  generateAiAdminMessengerToken,
} from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DeploymentHealth } from "@/components/owner/DeploymentHealth";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/messenger")({ component: Page });

const WEBHOOK_PATH = "/api/public/ai-admin/messenger-webhook";
// Facebook must always call the LIVE production site: that deployment owns the
// real payments/wallet database. A preview origin would receive the postbacks
// but could never find the payment, so Approve/Reject would silently fail.
const LIVE_WEBHOOK_URL = `https://orzen.top${WEBHOOK_PATH}`;

function Page() {
  const [MESSENGER_WEBHOOK_URL] = useState(LIVE_WEBHOOK_URL);
  const get = useServerFn(getAiAdminMessenger);
  const save = useServerFn(saveAiAdminMessenger);
  const verify = useServerFn(verifyAiAdminMessenger);
  const test = useServerFn(testAiAdminMessenger);
  const disconnect = useServerFn(disconnectAiAdminMessenger);
  const generateToken = useServerFn(generateAiAdminMessengerToken);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-admin", "messenger"], queryFn: () => get() });

  const [form, setForm] = useState({
    page_id: "",
    page_access_token: "",
    app_secret: "",
    verify_token: "",
  });
  const [psids, setPsids] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm((f) => ({
      ...f,
      page_id: data.page_id ?? "",
      verify_token: data.verify_token ?? "",
    }));
    setPsids((data.admin_psids ?? []).join("\n"));
  }, [data]);

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
        title="Messenger Connection"
        description="Control the AI Admin assistant from Facebook Messenger, alongside WhatsApp."
      />

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={connected ? "default" : "secondary"} className="gap-1">
            {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {connected ? "Connected" : data?.status === "error" ? "Error" : "Not connected"}
          </Badge>
          {data?.page_name ? <span className="text-sm">Connected page: <b>{data.page_name}</b></span> : null}
          {data?.credentials_hint ? (
            <span className="text-xs text-muted-foreground">Page token on file: {data.credentials_hint}</span>
          ) : null}
          {data?.last_error ? <span className="text-xs text-destructive">{data.last_error}</span> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Credentials</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Facebook Page ID</Label>
              <Input value={form.page_id} onChange={(e) => setForm({ ...form, page_id: e.target.value })} />
            </div>
            <div>
              <Label>Page Access Token</Label>
              <Input
                type="password"
                placeholder={data?.credentials_hint ? "Leave blank to keep the saved token" : ""}
                value={form.page_access_token}
                onChange={(e) => setForm({ ...form, page_access_token: e.target.value })}
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
            </div>
            <div>
              <Label>Allowed admin Messenger IDs (PSID)</Label>
              <Textarea
                rows={3}
                placeholder="One PSID per line"
                value={psids}
                onChange={(e) => setPsids(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Only these Messenger users can command the AI Admin. Message your page once, then copy the sender ID from
                Activity Logs or your Meta app webhook test.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                disabled={busy === "save"}
                onClick={() =>
                  run(
                    "save",
                    () =>
                      save({
                        data: {
                          ...form,
                          admin_psids: psids.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
                        },
                      }),
                    "Credentials saved",
                  )
                }
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
                  <Input readOnly value={MESSENGER_WEBHOOK_URL} />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(MESSENGER_WEBHOOK_URL);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this URL with your Verify Token into the Messenger product webhook settings of your Meta app, then
                subscribe the page to the <b>messages</b> and <b>messaging_postbacks</b> fields. Keep one callback URL
                only — never register a second endpoint.
              </p>
              <p className="text-xs text-muted-foreground">
                This must stay on the live domain — preview URLs cannot approve wallet payments.
              </p>
            </CardContent>
          </Card>

          <DeploymentHealth />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Test connection</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Send a test message to PSID</Label>
                <Input placeholder="1234567890" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              </div>
              <Button
                variant="outline"
                disabled={!testTo || busy === "test"}
                onClick={() => run("test", () => test({ data: { psid: testTo } }), "Test message sent")}
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
