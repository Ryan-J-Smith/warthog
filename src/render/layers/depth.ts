/** Render depth layers (Phaser `setDepth`). Lower draws first. */
export const DEPTH = {
  terrain: 0,
  decals: 10,
  groundShadows: 15,
  ground: 20,
  groundFx: 30,
  lowAir: 40,
  airShadows: 45,
  clouds: 50,
  air: 60,
  airFx: 65,
  worldUi: 80,
} as const;
