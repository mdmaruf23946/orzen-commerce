// Storefront-side theme context + the live-preview bridge used by the
// Theme Customization editor. The editor embeds the real storefront in an
// iframe and streams the merged theme over postMessage, so what the store
// admin sees is the actual store, not a mock.
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, mergeTheme, type ThemeDefinition } from "./definition";

export const THEME_PREVIEW_PARAM = "theme_preview";
export const THEME_PREVIEW_MESSAGE = "orzen:theme-preview";
export const THEME_PREVIEW_READY = "orzen:theme-preview-ready";

const Ctx = createContext<ThemeDefinition>(DEFAULT_THEME);

export function StoreThemeProvider({
  theme,
  children,
}: {
  theme: ThemeDefinition;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}

export function useStoreTheme(): ThemeDefinition {
  return useContext(Ctx);
}

/**
 * Inside the preview iframe: listen for theme payloads from the editor.
 * Returns null until the first payload arrives (or always, when not previewing).
 */
export function useThemePreviewListener(enabled: boolean): ThemeDefinition | null {
  const [preview, setPreview] = useState<ThemeDefinition | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== THEME_PREVIEW_MESSAGE) return;
      setPreview(mergeTheme(d.definition, d.overrides));
    };
    window.addEventListener("message", onMessage);
    // Re-announce a few times: the editor may attach its listener after we mount.
    const announce = () =>
      window.parent?.postMessage({ type: THEME_PREVIEW_READY }, window.location.origin);
    announce();
    const timers = [setTimeout(announce, 200), setTimeout(announce, 800), setTimeout(announce, 2000)];
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("message", onMessage);
    };
  }, [enabled]);

  return preview;
}
