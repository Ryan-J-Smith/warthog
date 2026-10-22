import { ENTITY_STATS, type GroundRoundKind } from '../../config';
import type { SimEvent, SimEventOf } from '../../sim/events';
import type { EntityKind } from '../../sim/types';
import { RAMPS } from './colorRamp';
import { rand, type FxKit } from './fxKit';
import { FX_TEXTURES } from './fxTextures';
import type { Particle } from './particleLayer';

/** Game-style bullets: enemy rounds are hot red/orange, friendly ones blue with a white core. */
const TEAM_COLORS = {
  enemy: { body: 0xff3b30, core: 0xffd8a0, glow: 0xff6a20 },
  friendly: { body: 0x5ab0ff, core: 0xffffff, glow: 0x7cc4ff },
} as const;
type TeamColors = (typeof TEAM_COLORS)[keyof typeof TEAM_COLORS];

/** How each round looks. Sizes are world units (= pixels of the 1920×1080 game canvas at camera zoom 1). */
interface RoundLook {
  /** Muzzle sits this far ahead of the shooter's centre. */
  muzzle: number;
  /** Muzzle flash / firing ring size. */
  flash: number;
  /** Orb diameter and its hot core. */
  orb: number;
  core: number;
  /** Additive glow around the orb (0 = none). */
  glow: number;
  /** Orbs per shot, `burstGap` seconds apart (the sim deals the shot's damage once, as the first lands). */
  burst: number;
  burstGap: number;
  /** Fading trail behind the orb (0 = none). */
  trail: number;
  /** Impact pop size. */
  pop: number;
}

const LOOKS: Record<GroundRoundKind, RoundLook> = {
  smallArms: { muzzle: 6, flash: 12, orb: 9, core: 4, glow: 0, burst: 3, burstGap: 0.07, trail: 0, pop: 16 },
  cannon: { muzzle: 14, flash: 28, orb: 18, core: 7, glow: 36, burst: 1, burstGap: 0, trail: 34, pop: 34 },
  autocannon: { muzzle: 8, flash: 14, orb: 11, core: 5, glow: 18, burst: 2, burstGap: 0.06, trail: 0, pop: 18 },
};

/**
 * Ground-battle rounds as team-coloured bullets: the shooter flashes (a few frames of muzzle
 * flash and a team-coloured ring), then orbs travel from it to where the simulation will land
 * the round, over the simulation's own flight time, then the impact the simulation resolved: a
 * team-coloured pop on a hit, dust on a miss. Orbs have a dark rim so they read on sand and snow.
 * Everything is drawn with the kit's pooled particles (2–4 per orb) for Three Roads' 40+ units.
 */
export class GroundRoundFx {
  constructor(private readonly kit: FxKit) {}

  handleEvent(e: SimEvent): void {
    if (e.type === 'groundFire') this.fire(e);
    else if (e.type === 'groundRoundImpact') this.impact(e);
  }

  private fire(e: SimEventOf<'groundFire'>): void {
    const kit = this.kit;
    const look = LOOKS[e.round];
    const colors = teamColors(e.shooterKind);
    const { from, to } = e;
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    const mx = from.x + Math.cos(heading) * look.muzzle;
    const my = from.y + Math.sin(heading) * look.muzzle;
    const travel = Math.max(e.flightTime, 0.02);

    // Firing animation on the emitter.
    kit.muzzleFlash('ground', mx, my, heading, look.flash, 0xffe6a0, e.round === 'cannon' ? 0.08 : 0.06);
    kit.ring('ground', mx, my, look.flash * 0.25, look.flash, 0.14, colors.body, 0.9);
    if (e.round === 'cannon') {
      kit.smoke('ground', mx, my, 2, { spread: 3, speed: 18, size0: 5, size1: 22, life: 1.3, alpha: 0.4, ramp: RAMPS.smokeGrey });
    }

    // The orbs start at the shooter's centre so the first arrives exactly on the simulation's schedule.
    const vx = (to.x - from.x) / travel;
    const vy = (to.y - from.y) / travel;
    for (let i = 0; i < look.burst; i++) this.orb(from.x, from.y, vx, vy, travel, i * look.burstGap, look, colors);
  }

  private orb(x: number, y: number, vx: number, vy: number, life: number, delay: number, look: RoundLook, colors: TeamColors): void {
    const layers = this.kit.layers;
    if (look.trail > 0) {
      // A tracer streak whose bright head sits on the orb.
      const speed = Math.hypot(vx, vy) || 1;
      const back = look.trail * 0.36;
      const trail = layers.groundMid.spawn(FX_TEXTURES.tracer, x - (vx / speed) * back, y - (vy / speed) * back);
      if (trail) {
        setMoving(trail, vx, vy, life, delay, look.trail);
        trail.align = true;
        trail.alpha = 0.75;
        trail.tint = colors.body;
      }
    }
    if (look.glow > 0) {
      const glow = layers.groundAdd.spawn('particleSoft', x, y);
      if (glow) {
        setMoving(glow, vx, vy, life, delay, look.glow);
        glow.alpha = 0.6;
        glow.tint = colors.glow;
      }
    }
    const body = layers.groundMid.spawn(FX_TEXTURES.orb, x, y);
    if (body) {
      setMoving(body, vx, vy, life, delay, look.orb);
      body.tint = colors.body;
    }
    const core = layers.groundOver.spawn('particleSoft', x, y);
    if (core) {
      setMoving(core, vx, vy, life, delay, look.core * 2);
      core.tint = colors.core;
    }
  }

  private impact(e: SimEventOf<'groundRoundImpact'>): void {
    const kit = this.kit;
    const look = LOOKS[e.round];
    const { x, y } = e.pos;
    if (e.hit) {
      const colors = teamColors(e.shooterKind);
      kit.ring('ground', x, y, look.pop * 0.3, look.pop, 0.18, colors.body, 0.9);
      kit.flash('ground', x, y, look.pop, 0.1, colors.glow, 0.8);
      if (e.armored) kit.sparks('ground', x, y, e.round === 'cannon' ? 4 : 2, 70, 200, 0.28, e.round === 'cannon' ? 10 : 7);
    }
    if (e.round === 'cannon') {
      this.puff(x, y, 16);
      if (!e.hit) kit.debris('ground', x, y, 2, 80, 0x6b5a3e, 3);
    } else if (!e.hit) {
      this.puff(x + rand(-2, 2), y + rand(-2, 2), 8);
    }
  }

  private puff(x: number, y: number, size: number): void {
    const p = this.kit.layers.groundUnder.spawn('particleSmoke', x, y);
    if (!p) return;
    p.life = 0.9;
    p.size0 = size * 0.4;
    p.size1 = size * 1.5;
    p.alpha = 0.55;
    p.fadeIn = 0.05;
    p.fadeStart = 0.25;
    p.rotation = Math.random() * 6.28;
    p.wind = 0.6;
    p.ramp = RAMPS.dust;
  }
}

function teamColors(shooterKind: EntityKind): TeamColors {
  return ENTITY_STATS[shooterKind].team === 'friendly' ? TEAM_COLORS.friendly : TEAM_COLORS.enemy;
}

/** A fixed-size particle flying at constant velocity for its whole life, blinking out on arrival. */
function setMoving(p: Particle, vx: number, vy: number, life: number, delay: number, size: number): void {
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.delay = delay;
  p.size0 = size;
  p.size1 = size;
  p.grow = 1;
  p.fadeStart = 0.97;
}
