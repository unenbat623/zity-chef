/**
 * WCAG contrast helpers used to keep the (user-customisable) accent colour
 * readable in both themes. The accent doubles as a filled button background
 * carrying white text and as a text/icon colour on the page background — those
 * two roles pull in opposite directions, so each gets its own derived shade.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const mix = (c: Rgb, target: Rgb, t: number): Rgb => ({
  r: c.r + (target.r - c.r) * t,
  g: c.g + (target.g - c.g) * t,
  b: c.b + (target.b - c.b) * t,
});

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Nudges `color` toward black or white — whichever direction moves away from
 * `against` — until it reaches `target` contrast. Returns the original when it
 * already passes, and the best attainable shade when the target is impossible.
 */
export function ensureContrast(color: string, against: string, target = 4.5): string {
  const fg = hexToRgb(color);
  const bg = hexToRgb(against);
  if (!fg || !bg) return color;
  if (contrastRatio(fg, bg) >= target) return color;

  const toward = relativeLuminance(bg) > 0.5 ? BLACK : WHITE;
  let best = fg;
  for (let step = 1; step <= 20; step++) {
    const candidate = mix(fg, toward, step / 20);
    best = candidate;
    if (contrastRatio(candidate, bg) >= target) break;
  }
  return rgbToHex(best);
}

/** Black or white — whichever is more readable on `background`. */
export function readableTextOn(background: string): string {
  const bg = hexToRgb(background);
  if (!bg) return '#FFFFFF';
  return contrastRatio(WHITE, bg) >= contrastRatio({ r: 15, g: 23, b: 42 }, bg)
    ? '#FFFFFF'
    : '#0F172A';
}
