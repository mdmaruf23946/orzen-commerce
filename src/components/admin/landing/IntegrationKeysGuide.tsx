import { Copy, RefreshCw, KeyRound, Link2, ShieldCheck, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = {
  key: string;
  icon: typeof Copy;
  title: string;
  desc: string;
  where: string;
  aliases: string[];
  value: string | null;
  hidden?: string;
  onRotate?: () => void;
  usedFor: string;
};

export function IntegrationKeysGuide(props: {
  webhookUrl: string;
  apiUrl: string;
  embedUrl: string;
  storeUrl: string;
  newSecret: string | null;
  newKey: string | null;
  hasSecret: boolean;
  keyLast4: string | null;
  onRotateSecret: () => void;
  onRotateKey: () => void;
}) {
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("Copy হয়েছে"));

  const items: Item[] = [
    {
      key: "store", icon: Link2, title: "Store URL (Orzen ঠিকানা)",
      desc: "আপনার Orzen দোকানের মূল ঠিকানা। কিছু প্লাগিন প্রথমে এটা চায়।",
      where: "বাইরের সাইটের প্লাগিনে “Store URL / Site URL / Base URL” ঘরে বসান।",
      aliases: ["Store URL", "Site URL", "Base URL", "Domain"], value: props.storeUrl, usedFor: "সব পদ্ধতিতে",
    },
    {
      key: "webhook", icon: Link2, title: "Webhook URL (অর্ডার পাঠানোর ঠিকানা)",
      desc: "বাইরের সাইটে অর্ডার হলে এই ঠিকানায় অর্ডারটি পাঠানো হয়, তারপর Orzen-এর Orders-এ চলে আসে।",
      where: "প্লাগিনের “Webhook URL / Delivery URL / Endpoint / Callback URL / Order URL” ঘরে বসান। WooCommerce: Settings → Advanced → Webhooks → Add webhook → Delivery URL।",
      aliases: ["Webhook URL", "Delivery URL", "Endpoint", "Callback URL", "Order URL"], value: props.webhookUrl, usedFor: "Webhook পদ্ধতি",
    },
    {
      key: "secret", icon: ShieldCheck, title: "Webhook Secret (গোপন সই-চাবি)",
      desc: "এটা দিয়ে প্রমাণ হয় অর্ডারটা সত্যিই আপনার সাইট থেকে এসেছে, ভুয়া কেউ পাঠায়নি। কারো সাথে শেয়ার করবেন না।",
      where: "প্লাগিনের “Secret / Webhook Secret / Signing Secret / Secret Key” ঘরে বসান। (এটা WooCommerce-এর Consumer Secret নয়।)",
      aliases: ["Secret", "Webhook Secret", "Signing Secret", "Secret Key"], value: props.newSecret,
      hidden: props.hasSecret ? "নিরাপত্তার জন্য পুরোনো চাবি আর দেখানো হয় না। হারিয়ে গেলে “নতুন চাবি বানান” চাপুন — তারপর বাইরের সাইটেও নতুনটা বসাবেন।" : "এখনো কোনো চাবি নেই — “নতুন চাবি বানান” চাপুন।",
      onRotate: props.onRotateSecret, usedFor: "Webhook পদ্ধতি",
    },
    {
      key: "api", icon: Link2, title: "API URL (সরাসরি সংযোগের ঠিকানা)",
      desc: "ডেভেলপার নিজের কোড দিয়ে অর্ডার পাঠাতে চাইলে এই ঠিকানা ব্যবহার হয়।",
      where: "প্লাগিন/কোডের “API URL / API Endpoint / Base API URL” ঘরে বসান।",
      aliases: ["API URL", "API Endpoint", "REST URL"], value: props.apiUrl, usedFor: "API পদ্ধতি",
    },
    {
      key: "apikey", icon: KeyRound, title: "API Key (প্রবেশ চাবি)",
      desc: "API URL-এ অর্ডার পাঠানোর অনুমতির চাবি। এটা পাসওয়ার্ডের মতো — গোপন রাখুন।",
      where: "প্লাগিনের “API Key / Access Token / Bearer Token / X-API-Key” ঘরে বসান। (এটা WooCommerce-এর Consumer Key নয়।)",
      aliases: ["API Key", "Access Token", "Bearer Token", "X-API-Key"], value: props.newKey,
      hidden: props.keyLast4 ? `চাবির শেষ ৪ অক্ষর: …${props.keyLast4}। পুরো চাবি আর দেখানো হয় না; হারিয়ে গেলে নতুন বানান।` : "এখনো কোনো চাবি নেই — “নতুন চাবি বানান” চাপুন।",
      onRotate: props.onRotateKey, usedFor: "API পদ্ধতি",
    },
    {
      key: "embed", icon: Code2, title: "Embed URL (ফর্মের ঠিকানা)",
      desc: "ল্যান্ডিং পেজের সাধারণ অর্ডার ফর্ম (HTML/JS) থেকে সরাসরি অর্ডার পাঠাতে। কোনো গোপন চাবি লাগে না।",
      where: "ফর্মের “Form action / Submit URL / Embed URL” ঘরে বসান।",
      aliases: ["Embed URL", "Form action", "Submit URL"], value: props.embedUrl, usedFor: "Embed/ফর্ম পদ্ধতি",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-semibold">কীভাবে সংযোগ করবেন</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>বাইরের সাইটের প্লাগিন/সেটিংস খুলুন।</li>
          <li>নিচের প্রতিটি ঘরের নাম মিলিয়ে নিন — প্লাগিনে নাম আলাদা হতে পারে, তাই “অন্য নাম” দেখুন।</li>
          <li>Copy বাটন চেপে সঠিক ঘরে বসান, তারপর Save করুন।</li>
          <li>উপরের “Test order” চেপে দেখুন অর্ডার আসছে কিনা।</li>
        </ol>
        <div className="mt-2 text-xs text-muted-foreground">সবগুলো লাগবে না: Webhook পদ্ধতিতে শুধু Webhook URL + Secret; API পদ্ধতিতে API URL + API Key; ফর্মে শুধু Embed URL।</div>
      </div>

      {items.map((it) => (
        <div key={it.key} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <it.icon className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">{it.title}</div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{it.usedFor}</span>
            </div>
            {it.onRotate && (
              <Button variant="outline" size="sm" onClick={it.onRotate}>
                <RefreshCw className="mr-1 h-3 w-3" /> নতুন চাবি বানান
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
          <p className="mt-1 text-xs"><span className="font-medium">কোথায় বসাবেন: </span>{it.where}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="text-[11px] text-muted-foreground">অন্য নাম:</span>
            {it.aliases.map((a) => <span key={a} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{a}</span>)}
          </div>
          {it.value ? (
            <div className="mt-2 flex gap-2">
              <Input readOnly value={it.value} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(it.value!)}><Copy className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">{it.hidden}</div>
          )}
        </div>
      ))}
    </div>
  );
}
