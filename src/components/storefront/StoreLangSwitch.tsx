import { useStoreT } from "@/lib/store-i18n";

/**
 * Compact EN | বাংলা toggle for the storefront header / drawer.
 * Renders nothing when the merchant disabled the switcher.
 */
export function StoreLangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, switcherEnabled } = useStoreT();
  if (!switcherEnabled) return null;

  const btn = (active: boolean) =>
    `px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors ${
      active ? "text-white" : "text-neutral-600 hover:text-neutral-900"
    }`;

  return (
    <div
      className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border border-black/10 bg-white/70 ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        className={btn(lang === "en")}
        style={lang === "en" ? { backgroundColor: "var(--store-btn-bg, #0f172a)" } : undefined}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bn")}
        className={btn(lang === "bn")}
        style={lang === "bn" ? { backgroundColor: "var(--store-btn-bg, #0f172a)" } : undefined}
        aria-pressed={lang === "bn"}
      >
        বাংলা
      </button>
    </div>
  );
}
