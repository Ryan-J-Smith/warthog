import type { GroundRoundKind } from '../../config';
import type { SimEvent, SimEventOf } from '../../sim/events';
import { RAMPS } from './colorRamp';
import { rand, type FxKit } from './fxKit';
import { FX_TEXTURES } from './fxTextures';

/** The tracer texture is 64×8: its height is 1/8 of its drawn width. */
const TRACER_ASPECT = 8;

/** How each round looks. Lengths and sizes are world units. */
interface RoundLook {
  /** Muzzle sits this far ahead of the shooter's centre. */
  muzzle: number;
  flash: number;
  tracerLength: number;
  /** Tracer thickness, world units. */
  tracerWidth: number;
  tracerTint: number;
  tracerAlpha: number;
  /** Glow riding the tracer head (the shell / bullet itself). */
  glow: number;
  glowTint: number;
}

const LOOKS: Record<GroundRoundKind, RoundLook> = {
  smallArms: { muzzle: 6, flash: 10, tracerLength: 18, tracerWidth: 3.5, tracerTint: 0xfff0b0, tracerAlpha: 1, glow: 7, glowTint: 0xffe0a0 },
  cannon: { muzzle: 14, flash: 26, tracerLength: 28, tracerWidth: 6, tracerTint: 0xffe2a0, tracerAlpha: 1, glow: 20, glowTint: 0xffb060 },
  autocannon: { muzzle: 8, flash: 13, tracerLength: 20, tracerWidth: 4, tracerTint: 0xffd890, tracerAlpha: 1, glow: 9, glowTint: 0xffc070 },
};

/**
 * Ground-battle rounds: a muzzle flash and a round that travels from the shooter to where the
 * simulation will land it, over the simulation's own flight time, then the impact the simulation
 * resolved (sparks on armor, a dirt kick on a miss, a puff for tank shells). Everything is drawn
 * with the kit's pooled particles; a few particles per shot keeps Three Roads' dozens of units cheap.
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
    const { from, to } = e;
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    const mx = from.x + Math.cos(heading) * look.muzzle;
    const my = from.y + Math.sin(heading) * look.muzzle;
    const travel = Math.max(e.flightTime, 0.02);
    kit.muzzleFlash('ground', mx, my, heading, look.flash, 0xffd890, e.round === 'cannon' ? 0.07 : 0.05);
    if (e.round === 'cannon') {
      kit.smoke('ground', mx, my, 2, { spread: 3, speed: 18, size0: 5, size1: 22, life: 1.3, alpha: 0.4, ramp: RAMPS.smokeGrey });
    }
    // The round starts at the shooter's centre so it arrives exactly on the simulation's schedule.
    const vx = (to.x - from.x) / travel;
    const vy = (to.y - from.y) / travel;
    this.tracer(from.x, from.y, vx, vy, travel, look);
    const glow = kit.flash('ground', from.x, from.y, look.glow, travel, look.glowTint, 0.9);
    if (glow) {
      glow.vx = vx;
      glow.vy = vy;
      glow.size0 = look.glow;
      glow.grow = 1;
      glow.fadeStart = 0.9;
    }
  }

  /** Like `FxKit.streak`, but thicker than the texture's own aspect so it reads at gameplay zoom. */
  private tracer(x: number, y: number, vx: number, vy: number, life: number, look: RoundLook): void {
    const p = this.kit.layers.groundAdd.spawn(FX_TEXTURES.tracer, x, y);
    if (!p) return;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.size0 = look.tracerWidth * TRACER_ASPECT;
    p.size1 = p.size0;
    p.stretch = look.tracerLength / p.size0;
    p.alpha = look.tracerAlpha;
    p.fadeStart = 0.85;
    p.align = true;
    p.tint = look.tracerTint;
  }

  private impact(e: SimEventOf<'groundRoundImpact'>): void {
    const kit = this.kit;
    const { x, y } = e.pos;
    if (e.round === 'cannon') {
      kit.flash('ground', x, y, 28, 0.12, 0xffc070, 0.8);
      this.puff(x, y, 16);
      if (e.armored && e.hit) kit.sparks('ground', x, y, 4, 80, 220, 0.3, 10);
      else kit.debris('ground', x, y, 2, 80, 0x6b5a3e, 3);
      return;
    }
    if (e.hit && e.armored) kit.sparks('ground', x, y, 2, 60, 160, 0.25, 7);
    else if (e.hit) kit.flash('ground', x, y, 8, 0.06, 0xfff0c8, 0.8);
    else this.puff(x + rand(-2, 2), y + rand(-2, 2), 7);
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
