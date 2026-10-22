import Phaser from 'phaser';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH, aircraftHeight, heightScale } from '../layers';
import { RAMPS } from './colorRamp';
import { FX_TEXTURES } from './fxTextures';
import { rand, type FxKit } from './fxKit';

/** Engine nozzles in the A-10 sprite's frame (world units, nose = +x). */
const NOZZLES = [
  { x: -42, y: -17 },
  { x: -42, y: 17 },
] as const;
/** Wingtip speed-brake positions (the A-10's split ailerons). */
const WINGTIPS = [
  { x: -6, y: -74 },
  { x: -6, y: 74 },
] as const;

const SHIELD_COLOR = 0x6fe0ff;

/**
 * Effects attached to the player's aircraft: afterburner flames + heat trail while boosting,
 * vapour at the wingtips under the air brake, a shield bubble that flashes when hit, shatters when
 * it fails and shimmers while it recharges, and a hot glow on the nose during GAU-8 overdrive.
 */
export class AircraftFx {
  private readonly flames: Phaser.GameObjects.Image[];
  private readonly cores: Phaser.GameObjects.Image[];
  private readonly shield: Phaser.GameObjects.Image;
  private readonly overdrive: Phaser.GameObjects.Image;
  private shieldFlash = 0;
  private regenShimmer = 0;
  private trailTick = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly kit: FxKit,
  ) {
    const add = (tex: string, tint: number): Phaser.GameObjects.Image =>
      scene.add.image(0, 0, tex).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.air - 1).setVisible(false);
    // Above the airframe: the A-10's exhaust blows over its tailplane.
    this.flames = NOZZLES.map(() => add('particleSoft', 0x3a8cff).setDepth(DEPTH.air + 0.5));
    this.cores = NOZZLES.map(() => add('particleSoft', 0xfff2d0).setDepth(DEPTH.air + 0.6));
    this.shield = scene.add.image(0, 0, scene.textures.exists('shieldRing') ? 'shieldRing' : FX_TEXTURES.ring).setTint(SHIELD_COLOR).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.airFx).setVisible(false);
    this.overdrive = add('particleSoft', 0xff6a2a).setDepth(DEPTH.airFx);
  }

  handleEvent(e: SimEvent, view: WorldView): void {
    const p = view.player;
    switch (e.type) {
      case 'shieldHit':
        this.shieldFlash = Math.min(1, this.shieldFlash + (e.source === 'beam' ? 0.25 : 1));
        break;
      case 'shieldDown':
        this.shieldFlash = 1;
        this.kit.ring('air', p.pos.x, p.pos.y, 60, 170, 0.4, SHIELD_COLOR, 0.9, true);
        this.kit.sparks('air', p.pos.x, p.pos.y, 16, 120, 320, 0.45, 12);
        break;
      case 'shieldRegenStarted':
        this.regenShimmer = 1;
        break;
      case 'shieldFull':
        this.kit.ring('air', p.pos.x, p.pos.y, 70, 110, 0.3, SHIELD_COLOR, 0.6, true);
        break;
      case 'boostStarted':
        for (const n of NOZZLES) {
          const w = this.toWorld(view, n.x - 8, n.y);
          this.kit.flash('air', w.x, w.y, 46, 0.12, 0x9fd8ff, 0.9);
        }
        break;
      case 'brakeStarted':
        for (const tip of WINGTIPS) {
          const w = this.toWorld(view, tip.x, tip.y);
          this.kit.smoke('air', w.x, w.y, 2, { spread: 3, speed: 10, size0: 8, size1: 26, life: 0.5, alpha: 0.4, ramp: RAMPS.smokeWhite });
        }
        break;
      default:
        break;
    }
  }

  update(dt: number, view: WorldView): void {
    const p = view.player;
    const scale = heightScale(aircraftHeight(p.alt));
    const now = view.time;

    // Afterburner.
    const burning = p.alive && p.boosting && !view.ended;
    NOZZLES.forEach((n, i) => {
      const flame = this.flames[i];
      const core = this.cores[i];
      if (!flame || !core) return;
      flame.setVisible(burning);
      core.setVisible(burning);
      if (!burning) return;
      const flicker = 0.85 + Math.sin(now * 50 + i * 2) * 0.1 + rand(-0.06, 0.06);
      const len = 110 * flicker * scale;
      const back = this.toWorld(view, n.x - len * 0.5, n.y);
      flame.setPosition(back.x, back.y).setRotation(p.heading).setDisplaySize(len, 30 * scale).setAlpha(0.95);
      const coreAt = this.toWorld(view, n.x - len * 0.25, n.y);
      core.setPosition(coreAt.x, coreAt.y).setRotation(p.heading).setDisplaySize(len * 0.5, 13 * scale).setAlpha(1);
    });
    if (burning) {
      this.trailTick += dt;
      if (this.trailTick > 0.04) {
        this.trailTick = 0;
        for (const n of NOZZLES) {
          const w = this.toWorld(view, n.x - 40, n.y);
          this.kit.smoke('air', w.x, w.y, 1, { spread: 2, speed: 6, size0: 7, size1: 20, life: 0.45, alpha: 0.25, ramp: RAMPS.smokeWhite });
        }
      }
    }

    // Air brake: wingtip vapour while held.
    if (p.alive && p.braking && Math.random() < dt * 22) {
      const tip = WINGTIPS[Math.random() < 0.5 ? 0 : 1];
      const w = this.toWorld(view, tip.x, tip.y);
      this.kit.smoke('air', w.x, w.y, 1, { spread: 2, speed: 8, size0: 5, size1: 18, life: 0.45, alpha: 0.35, ramp: RAMPS.smokeWhite });
    }

    // Shield bubble.
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3);
    this.regenShimmer = p.shield < p.maxShield && p.shieldRegenIn <= 0 ? 1 : Math.max(0, this.regenShimmer - dt * 2);
    const regenAlpha = this.regenShimmer * (0.12 + Math.sin(now * 9) * 0.06);
    const alpha = Math.max(this.shieldFlash * 0.8, regenAlpha);
    this.shield.setVisible(p.alive && alpha > 0.01);
    if (this.shield.visible) {
      const size = 190 * scale * (1 + this.shieldFlash * 0.06);
      this.shield.setPosition(p.pos.x, p.pos.y).setDisplaySize(size, size).setAlpha(alpha).setRotation(now * 0.6);
    }

    // Overdrive: hot nose glow.
    const od = p.alive && p.overdrive > 0;
    this.overdrive.setVisible(od);
    if (od) {
      const nose = this.toWorld(view, 64, 0);
      const pulse = 0.55 + Math.sin(now * 14) * 0.2;
      this.overdrive.setPosition(nose.x, nose.y).setDisplaySize(60 * scale, 60 * scale).setAlpha(pulse);
    }
  }

  destroy(): void {
    for (const img of [...this.flames, ...this.cores, this.shield, this.overdrive]) img.destroy();
  }

  /** A point in the aircraft's frame (nose = +x) → world. */
  private toWorld(view: WorldView, fx: number, fy: number): { x: number; y: number } {
    const p = view.player;
    const c = Math.cos(p.heading);
    const s = Math.sin(p.heading);
    return { x: p.pos.x + fx * c - fy * s, y: p.pos.y + fx * s + fy * c };
  }
}
