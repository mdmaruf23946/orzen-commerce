import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import { getStorePagePublic } from "@/lib/store-pages.functions";
import { storePageHead, StorePageView } from "@/lib/store-page-view";
import { StoreErrorState } from "@/components/storefront/StoreErrorState";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const PAGE_KEY = "contact-us";

export const Route = createFileRoute("/store/$slug/contact-us")({
  loader: ({ params }) => getStorePagePublic({ data: { slug: params.slug, pageKey: PAGE_KEY } }),
  head: ({ loaderData }) => storePageHead(loaderData, PAGE_KEY),
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:page" />,
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData() as any;
  return (
    <StorePageView slug={slug} pageKey={PAGE_KEY} data={data}>
      <ContactForm email={data?.store?.email ?? null} storeName={data?.store?.name ?? null} />
    </StorePageView>
  );
}

function ContactForm({ email, storeName }: { email: string | null; storeName: string | null }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  if (!email) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Message from ${name || "a customer"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${from}\nPhone: ${phone}\n\n${message}`,
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={submit} className="mt-8 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-bold text-slate-900">
        Send {storeName || "us"} a message
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className="bg-white" />
        <Input value={from} onChange={(e) => setFrom(e.target.value)} type="email" placeholder="Your email" required className="bg-white" />
      </div>
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="bg-white" />
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="How can we help?"
        rows={5}
        required
        className="bg-white"
      />
      <Button type="submit" className="bg-sf-accent text-white hover:bg-sf-accent/90">
        <Send className="mr-2 h-4 w-4" /> Send message
      </Button>
    </form>
  );
}
