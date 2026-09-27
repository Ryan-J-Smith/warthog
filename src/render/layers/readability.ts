/**
 * Readability aids: when the camera zooms out, ground vehicles are drawn larger than their true
 * size so they stay legible (rule of cool over scale fidelity). Structures keep true size.
 */
export function unitDisplayScale(zoom: number): number {
  return Math.min(1.3, Math.max(1, Math.pow(zoom, -0.35)));
}

/** IFF marker opacity by player altitude (0..2): near-solid at Low (markers are keylined, so they stay clean), solid at High. */
export function iffAlpha(alt: number): number {
  return Math.min(1, 0.85 + Math.max(0, alt) * 0.075);
}
