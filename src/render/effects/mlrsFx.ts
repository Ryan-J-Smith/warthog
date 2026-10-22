import Phaser from 'phaser';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH } from '../layers';
import { RAMPS } from './colorRamp';
import { rand, type FxKit } from './fxKit';
import type { WreckFires } from './wreckFires';

const COLOR = {
  glow: 0xff5a1e,
  hot: 0xfff0d0,
  shock: 0xfff2da,
} as const;
/** The launcher box glows this long before the first rocket leaves (rings already showing). */
const CHARGE_GLOW = 0.6;
/** The tubes sit this far ahead of the vehicle centre (matches the sim's launch point). */
const TUBES = 22;
/** Cook-off after a kill: this many rocket pops over this many seconds. */
const COOK_OFF = { pops: 6, duration: 1.6 } as const;

interface PendingPop {
  at: number;
  x: number;
  y: number;
}

/**
 * MLRS effects: the launcher box glowing as a barrage charges, the ripple launch (flash, dust,
 * smoke cloud), the impacts (sized to the ring), and a rocket cook-off when one is destroyed.
 * The impact rings themselves are drawn by the world UI.
 */
export class MlrsFx {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly pops: PendingPop[] = [];
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly kit: FxKit,
    private readonly wrecks: WreckFires,
  ) {
    this.glow = scene.add.graphics().setDepth(DEPTH.groundFx + 0.5).setBlendMode(Phaser.BlendModes.ADD);
  }

  handleEvent(e: SimEvent): void {
    const kit = this.kit;
    switch (e.type) {
      case 'mlrsLaunched': {
        const x = e.pos.x + Math.cos(e.heading) * TUBES;
        const y = e.pos.y + Math.sin(e.heading) * TUBES;
        kit.flash('ground', x, y, 120, 0.25, 0xffd090, 0.75);
        kit.dustRing(e.pos.x, e.pos.y, 26, 14);
        kit.smoke('ground', x, y, 10, { spread: 18, speed: 50, size0: 14, size1: 64, life: 3.2, alpha: 0.6, ramp: RAMPS.smokeWhite, delay: 0.4 });
        kit.shaker.shakeAt(e.pos.x, e.pos.y, 0.004, 260);
        break;
      }
      case 'mlrsImpact':
        kit.explosion(e.pos.x, e.pos.y, 'small', { scale: e.radius / 34, dirt: true, shakeScale: 0.5 });
        // The shockwave runs out to the ring's edge: the blast is exactly the ring.
        kit.ring('ground', e.pos.x, e.pos.y, e.radius * 0.5, e.radius * 2, 0.35, COLOR.shock, 0.6);
        if (e.hitPlayer) kit.shaker.shake(0.008, 260);
        break;
      case 'entityDestroyed':
        if (e.kind === 'mlrs') {
          // Its remaining rockets cook off: a few delayed pops and streaks out of the wreck.
          for (let i = 0; i < COOK_OFF.pops; i++) {
            this.pops.push({ at: this.time + 0.2 + (COOK_OFF.duration * i) / COOK_OFF.pops + rand(0, 0.12), x: e.pos.x, y: e.pos.y });
          }
          this.wrecks.streamers(e.pos.x, e.pos.y, 4, 300, 'ground');
        }
        break;
      default:
        break;
    }
  }

  update(dt: number, view: WorldView): void {
    this.time += dt;
    this.glow.clear();
    for (const e of view.entities) {
      const m = e.mlrs;
      if (!m || !e.alive || e.hidden || m.strikes.length === 0) continue;
      const first = m.strikes[0];
      if (!first || first.launched) continue;
      // Charging: the tubes glow brighter until the first rocket leaves.
      const progress = 1 - Math.max(0, Math.min(1, (first.launchAt - view.time) / CHARGE_GLOW));
      const x = e.pos.x + Math.cos(e.heading) * TUBES;
      const y = e.pos.y + Math.sin(e.heading) * TUBES;
      this.glow.fillStyle(COLOR.glow, 0.25 + progress * 0.5);
      this.glow.fillCircle(x, y, 10 + progress * 16);
      this.glow.fillStyle(COLOR.hot, 0.2 + progress * 0.6);
      this.glow.fillCircle(x, y, 4 + progress * 6);
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i];
      if (!pop || pop.at > this.time) continue;
      this.pops.splice(i, 1);
      const a = rand(0, Math.PI * 2);
      const d = rand(80, 220);
      this.kit.flash('ground', pop.x + rand(-10, 10), pop.y + rand(-8, 8), 46, 0.12, 0xffc070, 0.85);
      this.kit.streak('low', pop.x, pop.y, pop.x + Math.cos(a) * d, pop.y + Math.sin(a) * d, 0.35, 22, 0xffd8a0, 0.8);
      this.kit.sparks('ground', pop.x, pop.y, 6, 120, 320, 0.5, 12);
      this.kit.smoke('ground', pop.x, pop.y, 2, { spread: 6, speed: 26, size0: 8, size1: 30, life: 1.6, alpha: 0.55, ramp: RAMPS.smokeDark });
    }
  }

  destroy(): void {
    this.glow.destroy();
    this.pops.length = 0;
  }
}
