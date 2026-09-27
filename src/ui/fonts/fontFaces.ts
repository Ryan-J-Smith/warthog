/** Font family names, as registered with the FontFace API and referenced by Phaser text styles. */
export const FONT_FAMILY = {
  /** Stencil military display face: titles, banners, the grade stamp. */
  display: 'Black Ops One',
  /** Clean tech mono: HUD numbers, labels, radio text, menus. */
  mono: 'Share Tech Mono',
} as const;

/** CSS `font-family` stacks with fallbacks, for Phaser text styles. */
export const FONT_STACK = {
  display: `"${FONT_FAMILY.display}", Impact, "Arial Black", sans-serif`,
  mono: `"${FONT_FAMILY.mono}", Consolas, "Courier New", monospace`,
} as const;

interface FontFile {
  family: string;
  /** Relative to the page, so the build works from any sub-path. */
  url: string;
}

const FONT_FILES: readonly FontFile[] = [
  { family: FONT_FAMILY.display, url: 'assets/fonts/BlackOpsOne-Regular.ttf' },
  { family: FONT_FAMILY.mono, url: 'assets/fonts/ShareTechMono-Regular.ttf' },
];

/** Never hold up the boot for longer than this; text falls back to the stack's system fonts. */
const LOAD_TIMEOUT_MS = 5000;

/**
 * Load the bundled fonts with the FontFace API so Phaser text renders with them from the first
 * frame. Always resolves, even if a font fails to load or the API is missing.
 */
export async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  const loads = FONT_FILES.map(async (file) => {
    try {
      const face = new FontFace(file.family, `url("${file.url}")`);
      await face.load();
      document.fonts.add(face);
    } catch (error) {
      console.info(`[warthog] font "${file.family}" unavailable, using fallback`, error);
    }
  });
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}
