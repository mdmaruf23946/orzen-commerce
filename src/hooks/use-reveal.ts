import { useEffect, useRef, useState } from "react";

/**
 * One shared IntersectionObserver for every revealed element on the page.
 * Creating one observer per card (dozens on a storefront) is a measurable
 * scroll cost on mobile; a single observer with a callback map is not.
 */
type Cb = () => void;
const callbacks = new WeakMap<Element, Cb>();
let sharedIO: IntersectionObserver | null = null;

function getIO() {
  if (sharedIO || typeof IntersectionObserver === "undefined") return sharedIO;
  sharedIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        sharedIO!.unobserve(entry.target);
        cb?.();
      }
    },
    // A small positive margin lets content settle before it scrolls in, so
    // nothing animates during the fast part of a flick.
    { rootMargin: "120px 0px", threshold: 0 },
  );
  return sharedIO;
}

/** True when the device is touch-first — reveal animations are skipped there. */
function skipReveal() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(_threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const io = getIO();
    if (!el || !io || skipReveal()) {
      setVisible(true);
      return;
    }
    callbacks.set(el, () => setVisible(true));
    io.observe(el);
    return () => {
      callbacks.delete(el);
      io.unobserve(el);
    };
  }, []);
  return { ref, visible };
}

export function useCountUp(target: number, start: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration]);
  return value;
}
