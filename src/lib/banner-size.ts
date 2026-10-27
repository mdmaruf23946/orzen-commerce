// Hero banner upload rule: 12:5 ratio, between 1200×500 and 1920×800 px.
export const HERO_MIN = { w: 1200, h: 500 };
export const HERO_MAX = { w: 1920, h: 800 };

export function heroBannerSizeError(w: number, h: number): string | null {
  if (w > HERO_MAX.w || h > HERO_MAX.h)
    return `ছবিটি বড়: ${w}×${h}px। সর্বোচ্চ ${HERO_MAX.w}×${HERO_MAX.h}px দিন।`;
  if (w < HERO_MIN.w || h < HERO_MIN.h)
    return `ছবিটি ছোট: ${w}×${h}px। কমপক্ষে ${HERO_MIN.w}×${HERO_MIN.h}px দিন।`;
  const ratio = w / h;
  if (Math.abs(ratio - 2.4) / 2.4 > 0.03)
    return `মাপ মিলছে না: ${w}×${h}px। প্রস্থ:উচ্চতা ১২:৫ হতে হবে (যেমন 1920×800)।`;
  return null;
}
