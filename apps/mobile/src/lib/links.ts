/**
 * A `tel:` link for a phone number as people write it ("+353 1 478 0000", "(01) 478-0000"). Keeps
 * the digits and a leading plus; anything else is dropped, so a stored value can't smuggle other
 * text into the link. Null when there is no digit to dial.
 */
export function telUrl(phone: string): string | null {
  const trimmed = phone.trim().replace(/^tel:/i, '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** A link that searches maps for a place or address. One https URL opens in any maps app or browser. */
export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
