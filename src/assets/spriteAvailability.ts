import { SPRITE_KEYS, spriteUrl, type SpriteKey } from './spriteKeys';

/**
 * Which sprite SVGs actually exist. Phaser's SVG loader throws on non-SVG responses (a dev
 * server answers missing files with index.html), so we only queue files that really are SVGs;
 * anything missing gets a generated placeholder texture instead.
 */
export async function probeSprites(): Promise<SpriteKey[]> {
  const results = await Promise.all(
    SPRITE_KEYS.map(async (key) => {
      try {
        const response = await fetch(spriteUrl(key), { method: 'HEAD' });
        const type = response.headers.get('content-type') ?? '';
        return response.ok && type.includes('svg') ? key : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((k): k is SpriteKey => k !== null);
}
