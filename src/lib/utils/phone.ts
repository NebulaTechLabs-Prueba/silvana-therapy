/**
 * Phone normalization for WhatsApp click-to-chat links.
 *
 * wa.me requires the number in international format, digits only (no `+`).
 * We accept inputs like "+54 9 11 2345-6789", "54911...", "(305) 555-1234",
 * strip non-digits, and attempt to produce something wa.me will open.
 *
 * Returns null when the input is clearly malformed (so the caller can
 * surface a "phone format invalid" warning to Silvana).
 */

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Minimum viable international number length: 8 digits
  // Max (E.164): 15 digits
  if (digits.length < 8 || digits.length > 15) return null;

  // If the user didn't write `+`, we can't safely guess the country code.
  // Still return the digits — wa.me tolerates missing `+` when the number
  // already includes country code. Common US case: 10 digits → prepend 1.
  if (!hadPlus && digits.length === 10) return '1' + digits;
  return digits;
}

export function isValidPhoneFormat(raw: string | null | undefined): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * Builds a wa.me URL with prefilled message. Returns null if phone is invalid.
 * Opens WhatsApp Web / Desktop / Mobile depending on platform.
 */
export function buildWaLink(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}
