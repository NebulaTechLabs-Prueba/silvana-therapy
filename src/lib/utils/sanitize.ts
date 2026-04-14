/**
 * Input sanitizers shared between public booking and admin forms.
 * Goal: prevent nonsense input like "A@@!!#" reaching the database
 * while being forgiving with accents, hyphens and apostrophes.
 */

/**
 * Keeps letters (any script, incl. accented), spaces, hyphens and
 * apostrophes. Collapses runs of whitespace. Trims leading whitespace
 * so the first character isn't a space. Caps length.
 */
export function sanitizeName(raw: string): string {
  if (!raw) return '';
  // Unicode letter class + space/-/'/./
  const cleaned = raw.replace(/[^\p{L}\s'\-.]/gu, '');
  return cleaned.replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, 80);
}

/** A name is "valid" if it has at least 2 letters after sanitization. */
export function isValidName(raw: string): boolean {
  const s = sanitizeName(raw).trim();
  const letters = s.replace(/[^\p{L}]/gu, '');
  return letters.length >= 2;
}

/**
 * For phone `<input>` on-change: accept a single leading `+` and
 * digits/spaces/dashes/parentheses for readability. Strips everything
 * else. Submit-time validation should still use `normalizePhone`.
 */
export function sanitizePhoneInput(raw: string): string {
  if (!raw) return '';
  const hadPlus = raw.trimStart().startsWith('+');
  const rest = raw.replace(/[^\d\s\-()]/g, '');
  return (hadPlus ? '+' : '') + rest.slice(0, 22);
}

/** Basic email shape check — submit-time only, not on-keystroke. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((raw || '').trim());
}
