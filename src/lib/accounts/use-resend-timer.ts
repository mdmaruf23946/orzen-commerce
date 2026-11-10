import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared "resend code" rules: a countdown before the button unlocks and a hard
 * cap on how many times a code can be sent in one sitting.
 */
export function useResendTimer(cooldownSec = 30, maxSends = 3) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sends, setSends] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    if (timer.current) return;
    timer.current = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [secondsLeft]);

  const markSent = useCallback(() => {
    setSends((n) => n + 1);
    setSecondsLeft(cooldownSec);
  }, [cooldownSec]);

  const reset = useCallback(() => {
    setSends(0);
    setSecondsLeft(0);
  }, []);

  const limitReached = sends >= maxSends;
  const canSend = secondsLeft === 0 && !limitReached;

  return { secondsLeft, sends, sendsLeft: Math.max(0, maxSends - sends), maxSends, limitReached, canSend, markSent, reset };
}

/** Friendly hint shown under every code form. */
export const CODE_INBOX_HINT =
  "কোড না পেলে Spam / Promotions ফোল্ডারটিও দেখুন — এবং ORZEN Security ঠিকানাটিকে \"Not spam\" করে দিন।";
