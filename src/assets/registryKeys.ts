/** Keys in the global Phaser registry for asset bookkeeping and game-wide shared services. */
export const REGISTRY = {
  /** `SpriteKey[]` of sprite files that exist (set by Boot). */
  availableSprites: 'availableSprites',
  /** The player's progression `SaveStore` (created on first use by `saveStoreFor`). */
  metaSave: 'metaSave',
} as const;
