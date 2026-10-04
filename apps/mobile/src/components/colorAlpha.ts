/** `#RRGGBB` at an opacity, as an 8-digit hex colour. For the tinted overlays the frames draw (3i). */
export function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${byte.toString(16).padStart(2, '0')}`;
}
