// Client-side store of the contact (phone/email) a guest used on an order.
// It is the ownership proof the server asks for before returning order PII.

const PRIMARY = (orderId: string) => `orzen_order_contact__${orderId}`;
const LEGACY = (orderId: string) => `orzen_n__${orderId}`;

export function readOrderContact(orderId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(PRIMARY(orderId)) ??
      window.localStorage.getItem(LEGACY(orderId))
    );
  } catch {
    return null;
  }
}

export function writeOrderContact(orderId: string, contact: string | null | undefined) {
  if (typeof window === "undefined" || !contact) return;
  try {
    window.localStorage.setItem(PRIMARY(orderId), contact);
  } catch {
    /* ignore */
  }
}
