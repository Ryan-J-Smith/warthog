/** Typographic minus, so negative numbers line up with positive ones in the HUD fonts. */
export const MINUS = '−';

/** 23450 → "23,450"; -1000 → "−1,000". Locale-independent. */
export function formatScore(value: number): string {
  const n = Math.round(value);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `${MINUS}${digits}` : digits;
}

/** 300 → "+300"; -1000 → "−1,000"; 0 → "0". */
export function formatSigned(value: number): string {
  const n = Math.round(value);
  if (n > 0) return `+${formatScore(n)}`;
  return formatScore(n);
}

/** Seconds → "M:SS" (e.g. 372 → "6:12"). Negative values clamp to 0. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds → "MM:SS" for the mission clock (e.g. 74 → "01:14"). */
export function formatMissionClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 0.643 → "64%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}
