import { useState } from "react";
import { Copy, Facebook, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const items = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`, icon: Facebook, color: "#1877F2" },
    { label: "Messenger", href: `fb-messenger://share/?link=${enc}`, icon: MessageCircle, color: "#0084FF" },
    { label: "WhatsApp", href: `https://wa.me/?text=${encTitle}%20${enc}`, icon: MessageCircle, color: "#25D366" },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc}&text=${encTitle}`, icon: Send, color: "#229ED9" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">Share this product</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <a
            key={it.label}
            href={it.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors hover:bg-neutral-50"
          >
            <it.icon className="h-4 w-4" style={{ color: it.color }} />
            {it.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors hover:bg-neutral-50"
        >
          <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy Link"}
        </button>
      </div>
    </section>
  );
}
