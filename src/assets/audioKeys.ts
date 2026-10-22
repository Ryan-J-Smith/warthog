/**
 * Every sound the game uses. The audio manifest (`audioManifest.ts`, owned by the audio track)
 * maps each key to one or more URLs under `public/assets/audio/`.
 */
export interface AudioSpec {
  kind: 'music' | 'sfx';
  loop: boolean;
  note: string;
}

export const AUDIO = {
  // Music
  musicTitle: { kind: 'music', loop: true, note: 'Title/briefing: moody, military, building tension.' },
  musicMission: { kind: 'music', loop: true, note: 'In-mission: driving action track, ~2+ min loop.' },
  stingVictory: { kind: 'music', loop: false, note: 'Short victory sting.' },
  stingDefeat: { kind: 'music', loop: false, note: 'Short defeat sting.' },

  // Player aircraft & weapons
  engineLoop: { kind: 'sfx', loop: true, note: 'A-10 TF34 turbofan whine/hum, seamless loop; pitch-shifted by speed.' },
  gunLoop: { kind: 'sfx', loop: true, note: 'GAU-8 BRRRT: very fast, deep, tearing buzz. Seamless loop while firing.' },
  gunTail: { kind: 'sfx', loop: false, note: 'BRRRT release tail / distant echo after the trigger is released.' },
  gunImpacts: { kind: 'sfx', loop: false, note: 'Crackle of many rounds hitting the ground.' },
  rocketLaunch: { kind: 'sfx', loop: false, note: 'Rocket salvo whoosh.' },
  missileLaunch: { kind: 'sfx', loop: false, note: 'Maverick launch roar.' },
  bombRelease: { kind: 'sfx', loop: false, note: 'Mechanical clunk of bomb release.' },
  bombWhistle: { kind: 'sfx', loop: false, note: 'Falling bomb whistle, ~1-2 s.' },
  lockTone: { kind: 'sfx', loop: false, note: 'Maverick lock acquired: short high beep-beep.' },
  flare: { kind: 'sfx', loop: false, note: 'Flare pop/hiss.' },
  dryFire: { kind: 'sfx', loop: false, note: 'Click / denied blip when a weapon cannot fire.' },
  weaponSwitch: { kind: 'sfx', loop: false, note: 'Weapon select click.' },

  // Explosions & impacts
  explosionSmall: { kind: 'sfx', loop: false, note: 'Small explosion (truck, infantry, rocket).' },
  explosionMedium: { kind: 'sfx', loop: false, note: 'Medium explosion (tank, AA).' },
  explosionLarge: { kind: 'sfx', loop: false, note: 'Large explosion (bomb, SAM site).' },
  explosionHuge: { kind: 'sfx', loop: false, note: 'Huge rumbling explosion (ammo dump, bridge).' },

  // Enemy fire & threats
  aaFire: { kind: 'sfx', loop: false, note: 'AA gun burst: rapid thump-thump-thump (a bit distant).' },
  samLaunch: { kind: 'sfx', loop: false, note: 'SAM launch: heavy rocket ignition roar.' },
  rwrLock: { kind: 'sfx', loop: false, note: 'Radar warning: SAM locking on (short tone, repeated by code).' },
  rwrLaunch: { kind: 'sfx', loop: true, note: 'MISSILE LAUNCH warning: urgent fast-warble loop.' },
  tankFire: { kind: 'sfx', loop: false, note: 'Distant tank cannon boom.' },
  smallArms: { kind: 'sfx', loop: false, note: 'Distant rifle/MG crackle.' },
  battleAmbience: { kind: 'sfx', loop: true, note: 'Distant ground battle ambience loop.' },

  // Player state
  playerHit: { kind: 'sfx', loop: false, note: 'Rounds hitting armored airframe: metallic clanks.' },
  playerExplode: { kind: 'sfx', loop: false, note: 'Player aircraft destroyed.' },
  rearmLoop: { kind: 'sfx', loop: true, note: 'Ground crew rearming: ratchets, clanks, loop.' },
  rearmComplete: { kind: 'sfx', loop: false, note: 'Rearm complete chime.' },
  lowHealth: { kind: 'sfx', loop: false, note: 'Warning beep for low HP.' },

  // Radio & UI
  radioIn: { kind: 'sfx', loop: false, note: 'Radio squelch/click at the start of a transmission.' },
  radioOut: { kind: 'sfx', loop: false, note: 'Radio squelch tail.' },
  objectiveComplete: { kind: 'sfx', loop: false, note: 'Positive objective-complete sting.' },
  objectiveFailed: { kind: 'sfx', loop: false, note: 'Negative objective-failed sting.' },
  uiMove: { kind: 'sfx', loop: false, note: 'Menu move blip.' },
  uiConfirm: { kind: 'sfx', loop: false, note: 'Menu confirm.' },
  uiBack: { kind: 'sfx', loop: false, note: 'Menu back.' },
  scoreTick: { kind: 'sfx', loop: false, note: 'Results screen score count tick.' },
  upgradeBuy: { kind: 'sfx', loop: false, note: 'Hangar purchase: mechanical click + bright "ka-ching".' },
  uiError: { kind: 'sfx', loop: false, note: 'Menu error / denied (e.g. not enough credits).' },

  // Movement tools
  boostLoop: { kind: 'sfx', loop: true, note: 'Afterburner roar, seamless loop while boosting (on top of the engine).' },
  boostStart: { kind: 'sfx', loop: false, note: 'Afterburner ignition whump on boost start.' },
  boostEmpty: { kind: 'sfx', loop: false, note: 'Afterburner sputter when the boost meter runs dry.' },
  airbrake: { kind: 'sfx', loop: false, note: 'Short pneumatic air-rush whoosh when the air brake deploys.' },

  // AA laser & shield
  aaCharge: { kind: 'sfx', loop: false, note: 'AA laser telegraph: rising charge whine (~1 s aim), pulsing during the final lock.' },
  aaBeamLoop: { kind: 'sfx', loop: true, note: 'AA laser beam: sizzling hum, seamless loop; one per firing gun, spatialised.' },
  shieldHit: { kind: 'sfx', loop: false, note: 'Energy crackle when the shield absorbs damage (rate-limited by code).' },
  shieldDown: { kind: 'sfx', loop: false, note: 'Shield shatters / powers down.' },
  shieldRegen: { kind: 'sfx', loop: false, note: 'Soft rising hum as the shield starts regenerating.' },
  shieldFull: { kind: 'sfx', loop: false, note: 'Subtle chime when the shield is fully charged.' },

  // Rewards
  samEvaded: { kind: 'sfx', loop: false, note: 'SAM out-turned: Doppler whoosh past + short positive blip.' },
  pickupCollect: { kind: 'sfx', loop: false, note: 'Pickup collected: satisfying, slightly military arcade chime.' },
  pickupSpawn: { kind: 'sfx', loop: false, note: 'Pickup dropped: tiny quiet sparkle.' },
  comboUp: { kind: 'sfx', loop: false, note: 'Kill chain grew: short rising blip (pitched up by chain in code).' },
  comboEnd: { kind: 'sfx', loop: false, note: 'Kill chain ended: soft descending blip.' },
  zoneCleared: { kind: 'sfx', loop: false, note: 'Defence zone cleared: punchy positive sting, shorter than objectiveComplete.' },

  // New enemies
  heliLoop: { kind: 'sfx', loop: true, note: 'Enemy helicopter rotor thump, seamless loop (spatialised per helicopter).' },
  mlrsLaunch: { kind: 'sfx', loop: false, note: 'MLRS rocket-artillery ripple launch.' },
} as const satisfies Record<string, AudioSpec>;

export type AudioKey = keyof typeof AUDIO;

export const AUDIO_KEYS = Object.keys(AUDIO) as AudioKey[];
