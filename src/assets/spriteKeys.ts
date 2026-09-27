/**
 * Every sprite the game uses. Each key maps to `public/assets/sprites/<key>.svg`.
 * `w` × `h` is the native size in world units (w = along the facing direction).
 * All vehicle/projectile sprites face EAST (+x) at rotation 0, drawn top-down.
 * Art direction: chunky toy arcade — bold saturated colours, thick dark outlines, exaggerated
 * (bigger-than-life) proportions, drawn to read instantly against lush green countryside.
 */
export interface SpriteSpec {
  w: number;
  h: number;
  note: string;
}

export const SPRITES = {
  // Player
  a10: { w: 144, h: 160, note: 'Player A-10 Warthog, top-down, nose east. CHUNKY TOY STYLE: fat fuselage, big straight wings, oversized twin tails and engine pods, comically big GAU-8 barrel at the nose.' },

  // Enemy vehicles (red accents, olive/tan bodies)
  tankHull: { w: 76, h: 50, note: 'Enemy tank hull: big, chunky, heavy armour (clearly bigger than a mech).' },
  tankTurret: { w: 68, h: 30, note: 'Enemy tank turret + fat barrel. Pivot at x=24,y=15 (turret ring centre).' },
  tankWreck: { w: 76, h: 50, note: 'Burnt-out tank (hull + turret, blackened).' },
  truck: { w: 52, h: 26, note: 'Enemy supply truck, cab at east end.' },
  truckWreck: { w: 52, h: 26, note: 'Burnt-out truck.' },
  infantry: { w: 52, h: 52, note: 'Enemy MECH (replaces infantry): a chunky bipedal walker seen from above, e.g. a squat cockpit/torso with arm guns and big feet, red accents. One mech per sprite.' },
  aaHull: { w: 58, h: 40, note: 'Self-propelled AA (Shilka-style) tracked hull.' },
  aaTurret: { w: 36, h: 32, note: 'AA turret with quad cannons pointing east. Pivot at centre.' },
  aaWreck: { w: 58, h: 40, note: 'Destroyed AA vehicle.' },
  samBase: { w: 120, h: 120, note: 'SAM site: circular sandbag revetment, radar dish + cabin to one side. No launcher.' },
  samLauncher: { w: 70, h: 38, note: 'Rotating SAM launcher: rails with 2 missiles pointing east. Pivot at centre.' },
  samWreck: { w: 120, h: 120, note: 'Destroyed SAM site (scorched revetment, debris).' },

  // Enemy structures
  bridge: { w: 260, h: 90, note: 'Road bridge, road runs east-west along its length. Steel truss or concrete.' },
  bridgeDestroyed: { w: 260, h: 90, note: 'Bridge with collapsed middle span, debris in water.' },
  ammoDump: { w: 240, h: 180, note: 'Enemy ammo dump: stacks of crates, fuel drums, camo net, sandbags.' },
  ammoDumpWreck: { w: 240, h: 180, note: 'Ammo dump after cook-off: craters, scattered debris.' },
  cache: { w: 48, h: 48, note: 'Hidden weapons cache under camo netting.' },

  // Friendly (blue accents)
  outpost: { w: 260, h: 260, note: 'Friendly outpost Bravo: sandbag walls, bunkers, tents, blue flag.' },
  outpostDestroyed: { w: 260, h: 260, note: 'Overrun outpost: flattened, burning.' },
  homeBase: { w: 480, h: 340, note: 'Forward airstrip: short runway east-west, rearm pad with blue markings, hangar, fuel bladders.' },
  friendlyTankHull: { w: 76, h: 50, note: 'Friendly tank hull, chunky, blue accents.' },
  friendlyTankTurret: { w: 68, h: 30, note: 'Friendly tank turret. Pivot at x=24,y=15.' },
  friendlyInfantry: { w: 52, h: 52, note: 'Friendly MECH (replaces infantry): chunky bipedal walker from above, blue accents.' },

  // Projectiles (face east)
  rocket: { w: 26, h: 9, note: 'Hydra rocket.' },
  maverick: { w: 40, h: 13, note: 'AGM-65 Maverick missile.' },
  bomb: { w: 30, h: 13, note: 'Mk-82 bomb with fins.' },
  samMissile: { w: 46, h: 12, note: 'Enemy SAM missile (white body, red band).' },
  flare: { w: 18, h: 18, note: 'Flare: bright white-yellow glowing dot.' },

  // Decals & particles (neutral/white particles get tinted at runtime)
  crater: { w: 90, h: 90, note: 'Bomb crater decal (soft edges, dark centre).' },
  scorch: { w: 130, h: 130, note: 'Scorch mark decal (irregular soft black).' },
  particleSoft: { w: 32, h: 32, note: 'White radial soft circle, alpha falloff. For fire/glow.' },
  particleSmoke: { w: 64, h: 64, note: 'White puffy smoke blob, soft alpha. Tinted grey/black at runtime.' },
  particleSpark: { w: 10, h: 3, note: 'White elongated spark streak.' },
  particleDebris: { w: 6, h: 6, note: 'Small irregular white debris chunk.' },
  cloud1: { w: 420, h: 260, note: 'Soft white cumulus cloud, seen from above. Semi-transparent edges.' },
  cloud2: { w: 360, h: 220, note: 'Cloud variant.' },
  cloud3: { w: 520, h: 300, note: 'Cloud variant (large).' },
  cloud4: { w: 300, h: 200, note: 'Cloud variant (small wispy).' },

  // UI / world-space HUD elements (white, tinted at runtime)
  reticleGun: { w: 48, h: 48, note: 'Gun pipper: ring with centre dot and tick marks.' },
  reticleBomb: { w: 56, h: 56, note: 'CCIP bomb reticle: diamond/cross with ring.' },
  reticleRocket: { w: 48, h: 48, note: 'Rocket reticle: open square brackets with centre dot.' },
  lockBracket: { w: 64, h: 64, note: 'Maverick lock-on brackets (four corners).' },
  offscreenArrow: { w: 32, h: 32, note: 'Chevron arrow pointing east for off-screen objective markers.' },
  iconGun: { w: 64, h: 32, note: 'HUD icon: GAU-8 rotary cannon silhouette.' },
  iconRockets: { w: 64, h: 32, note: 'HUD icon: rocket pod.' },
  iconMaverick: { w: 64, h: 32, note: 'HUD icon: Maverick missile.' },
  iconBombs: { w: 64, h: 32, note: 'HUD icon: bomb.' },
  iconFlare: { w: 32, h: 32, note: 'HUD icon: flare burst.' },
} as const satisfies Record<string, SpriteSpec>;

export type SpriteKey = keyof typeof SPRITES;

export const SPRITE_KEYS = Object.keys(SPRITES) as SpriteKey[];

/** SVGs are rasterised at this multiple of native size for crispness; sprites display at 1/RES. */
export const SPRITE_RESOLUTION = 2;

export function spriteUrl(key: SpriteKey): string {
  return `assets/sprites/${key}.svg`;
}
