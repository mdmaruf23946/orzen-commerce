// Mobile number check shared by merchant and customer signup.
// Accepts Bangladeshi numbers (01XXXXXXXXX, +8801…, 8801…) or other
// international numbers written with a leading + (8–15 digits).
export function normalizeSignupPhone(raw: string): string | null {
  const s = String(raw ?? "").replace(/[\s\-()]/g, "");
  if (/^01[3-9]\d{8}$/.test(s)) return s;
  if (/^\+?8801[3-9]\d{8}$/.test(s)) return "0" + s.slice(s.length - 10);
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  return null;
}

export const PHONE_INVALID_MSG = "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।";
