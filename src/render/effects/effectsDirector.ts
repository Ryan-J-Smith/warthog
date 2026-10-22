import type Phaser from 'phaser';
import { SimEventListener } from '../../sim/events';
import type { SimEvent, SimEventOf } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH } from '../layers';
import { AircraftFx } from './aircraftFx';
import { BeamRenderer } from './beamRenderer';
import { RAMPS } from './colorRamp';
import { FloatingTexts } from './floatingText';
import { FxKit, rand } from './fxKit';
import { ensureFxTextures } from './fxTextures';
import { PickupRenderer } from './pickupRenderer';
import { ProjectileRenderer } from './projectileRenderer';
import { WreckFires } from './wreckFires';

/**
 * Units and structures are drawn ~1.7–2× their v0 size (art direction v1), so kill explosions
 * are scaled to match (weapon-impact effects keep their gameplay radii).
 */
const UNIT_FX_SCALE = 1.7;

/** Live counts for debug overlays. */
export interface EffectsStats {
  particles: number;
  projectiles: number;
  wreckFires: number;
}

/**
 * Owns every transient visual and all projectile rendering.
 *
 * - `handleEvents` turns `SimEvent`s into effects (explosions, tracers, impacts, pings, score
 *   popups, camera shake, persistent burning wrecks).
 * - `update` advances particles and keeps one pooled sprite per live projectile in sync with
 *   `world.projectiles` (smoke trails, shadows, glows, bombs shrinking as they fall).
 *
 * Everything animates in `update`, so effects freeze while the game is paused. Requires the SVG
 * sprites (`loadAllSprites`) to be loaded before construction.
 */
export class EffectsDirector extends SimEventListener {
  private readonly kit: FxKit;
  private readonly wrecks: WreckFires;
  private readonly projectiles: ProjectileRenderer;
  private readonly texts: FloatingTexts;
  private readonly beams: BeamRenderer;
  private readonly pickups: PickupRenderer;
  private readonly aircraft: AircraftFx;
  private lastView: WorldView | null = null;
  private beamHitCooldown = 0;
  private gunTick = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    super();
    ensureFxTextures(scene);
    this.kit = new FxKit(scene);
    this.wrecks = new WreckFires(this.kit);
    this.projectiles = new ProjectileRenderer(scene, this.kit);
    this.texts = new FloatingTexts(scene, DEPTH.worldUi);
    this.beams = new BeamRenderer(scene, this.kit);
    this.pickups = new PickupRenderer(scene, this.kit, this.texts);
    this.aircraft = new AircraftFx(scene, this.kit);
  }

  get stats(): EffectsStats {
    return { particles: this.kit.liveCount, projectiles: this.projectiles.count, wreckFires: this.wrecks.count };
  }

  /** Wind that carries smoke, world units per second (default drifts east-north-east). */
  setWind(x: number, y: number): void {
    this.kit.windX = x;
    this.kit.windY = y;
  }

  handleEvents(events: readonly SimEvent[], view?: WorldView): void {
    if (this.destroyed) return;
    const v = view ?? this.lastView;
    for (const e of events) {
      this.handle(e);
      this.pickups.handleEvent(e);
      if (v) this.aircraft.handleEvent(e, v);
    }
  }

  update(dtMs: number, world: WorldView): void {
    if (this.destroyed) return;
    const dt = Math.min(Math.max(dtMs, 0), 50) / 1000;
    this.lastView = world;
    this.beamHitCooldown = Math.max(0, this.beamHitCooldown - dt);
    this.projectiles.update(dt, world.projectiles);
    if (world.pickups) this.pickups.update(world);
    if (world.entities) this.beams.update(dt, world);
    if (world.player.shield !== undefined) this.aircraft.update(dt, world);
    this.wrecks.update(dt);
    this.kit.update(dt);
    this.texts.update(dt);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.projectiles.destroy();
    this.beams.destroy();
    this.pickups.destroy();
    this.aircraft.destroy();
    this.wrecks.clear();
    this.kit.destroy();
    this.texts.destroy();
  }

  // ---------------------------------------------------------------------------

  private handle(e: SimEvent): void {
    const kit = this.kit;
    switch (e.type) {
      case 'gunFiring':
        this.gunFiring(e);
        break;
      case 'gunImpact':
        kit.gunImpact(e.pos.x, e.pos.y, e.hit, e.armored);
        break;
      case 'rocketLaunched':
        kit.muzzleFlash('air', e.pos.x, e.pos.y, e.heading, 18, 0xffcf80, 0.06);
        kit.smoke('low', e.pos.x, e.pos.y, 2, { spread: 3, speed: 20, size0: 5, size1: 18, life: 0.9, alpha: 0.45, ramp: RAMPS.smokeGrey });
        break;
      case 'missileLaunched':
        kit.muzzleFlash('air', e.pos.x, e.pos.y, e.heading, 30, 0xffe0a0, 0.1);
        kit.flash('air', e.pos.x, e.pos.y, 40, 0.15, 0xffd8a0, 0.7);
        kit.smoke('low', e.pos.x, e.pos.y, 5, { spread: 5, speed: 30, size0: 8, size1: 30, life: 1.4, alpha: 0.5, ramp: RAMPS.smokeGrey });
        break;
      case 'ordnanceImpact':
        this.ordnanceImpact(e);
        break;
      case 'entityDestroyed':
        this.entityDestroyed(e);
        break;
      case 'secondaryExplosion':
        kit.explosion(e.pos.x, e.pos.y, e.size, { scale: rand(0.75, 1.05) });
        kit.sparks('ground', e.pos.x, e.pos.y, 10, 120, 360, 1.3, 14);
        if (e.size !== 'small' && Math.random() < 0.6) this.wrecks.streamers(e.pos.x, e.pos.y, 2, 240, 'ground');
        break;
      case 'aaBurst':
        kit.flash('ground', e.pos.x, e.pos.y, 26, 0.1, 0xffc070, 0.7);
        kit.dustRing(e.pos.x, e.pos.y, 8, 5);
        break;
      case 'samLaunched':
        kit.flash('ground', e.pos.x, e.pos.y, 110, 0.3, 0xffe0a0, 0.75);
        kit.dustRing(e.pos.x, e.pos.y, 24, 16);
        kit.smoke('ground', e.pos.x, e.pos.y, 9, { spread: 10, speed: 55, size0: 12, size1: 56, life: 2.8, alpha: 0.6, ramp: RAMPS.smokeWhite, delay: 0.15 });
        kit.shaker.shakeAt(e.pos.x, e.pos.y, 0.004, 220);
        break;
      case 'samDetonated':
        kit.airburst(e.pos.x, e.pos.y, 16, 7);
        if (e.hitPlayer) kit.shaker.shake(0.014, 420);
        else kit.shaker.shakeAt(e.pos.x, e.pos.y, 0.004, 200);
        break;
      case 'samDecoyed':
        kit.flash('air', e.pos.x, e.pos.y, 34, 0.14, 0xfff0c0, 0.8);
        kit.smoke('air', e.pos.x, e.pos.y, 4, { spread: 4, speed: 22, size0: 8, size1: 28, life: 1.4, alpha: 0.6, ramp: RAMPS.flak });
        break;
      case 'samLostLock':
        kit.smoke('air', e.pos.x, e.pos.y, 2, { spread: 3, speed: 14, size0: 6, size1: 20, life: 1.1, alpha: 0.45, ramp: RAMPS.smokeGrey });
        break;
      case 'flareDeployed':
        kit.flash('air', e.pos.x, e.pos.y, 34, 0.14, 0xfff6d8, 1);
        kit.sparks('air', e.pos.x, e.pos.y, 6, 40, 130, 0.45, 8);
        break;
      case 'playerHit':
        if (e.source === 'beam') {
          // Continuous beam damage: a light, rate-limited sizzle instead of a hit per frame.
          if (this.beamHitCooldown > 0) break;
          this.beamHitCooldown = 0.12;
          kit.sparks('air', e.pos.x, e.pos.y, 4, 80, 220, 0.3, 10);
          kit.shaker.shake(0.002, 90);
          break;
        }
        kit.sparks('air', e.pos.x, e.pos.y, e.source === 'sam' ? 18 : 9, 80, 260, 0.35, 11);
        kit.flash('air', e.pos.x, e.pos.y, e.source === 'sam' ? 40 : 18, 0.1, 0xfff0c8, 0.9);
        kit.smoke('air', e.pos.x, e.pos.y, e.source === 'sam' ? 4 : 1, { spread: 4, speed: 20, size0: 6, size1: 22, life: 1, alpha: 0.5, ramp: RAMPS.smokeDark });
        kit.shaker.shake(e.source === 'sam' ? 0.012 : 0.0045, e.source === 'sam' ? 380 : 160);
        break;
      case 'playerDestroyed':
        kit.airburst(e.pos.x, e.pos.y, 34, 14);
        kit.fireball('air', e.pos.x, e.pos.y, 36, 18, 1.4);
        kit.debris('air', e.pos.x, e.pos.y, 12, 260, 0x6a6e70, 3.2);
        this.wrecks.streamers(e.pos.x, e.pos.y, 8, 320, 'air');
        kit.shaker.shake(0.022, 850);
        break;
      case 'shieldHit':
        if (e.source === 'sam') {
          kit.flash('air', e.pos.x, e.pos.y, 90, 0.16, 0x9fe8ff, 0.9);
          kit.shaker.shake(0.01, 300);
        }
        break;
      case 'samEvaded':
        kit.flash('air', e.pos.x, e.pos.y, 40, 0.15, 0xfff0c0, 0.8);
        this.texts.spawn(e.pos.x, e.pos.y - 40, 'MISSED!', true);
        break;
      case 'zoneCleared':
        kit.ring('ground', e.pos.x, e.pos.y, 60, 520, 0.9, 0xffd24a, 0.8, true);
        kit.ring('ground', e.pos.x, e.pos.y, 40, 380, 0.7, 0xffffff, 0.5, true, 0.15);
        this.texts.spawn(e.pos.x, e.pos.y - 70, `${e.name.toUpperCase()} CLEARED`, true);
        break;
      case 'entityRevealed':
        kit.revealPing(e.pos.x, e.pos.y);
        break;
      case 'scoreAwarded':
        if (e.pos && e.points !== 0) this.texts.spawn(e.pos.x, e.pos.y - 18, `${e.points > 0 ? '+' : ''}${e.points}`, e.points > 0);
        break;
      case 'groundFire':
        this.groundFire(e);
        break;
      default:
        break;
    }
  }

  private gunFiring(e: SimEventOf<'gunFiring'>): void {
    const kit = this.kit;
    const { muzzle, target, heading } = e;
    kit.muzzleFlash('air', muzzle.x, muzzle.y, heading, rand(20, 30), 0xffe6a0, 0.045);
    if (this.gunTick++ % 2 === 0) kit.gunSmoke(muzzle.x + Math.cos(heading) * 5, muzzle.y + Math.sin(heading) * 5);
    const tx = target.x + rand(-7, 7);
    const ty = target.y + rand(-7, 7);
    kit.streak('low', muzzle.x, muzzle.y, tx, ty, rand(0.2, 0.25), rand(24, 32), 0xffe9a8, 0.95);
  }

  private ordnanceImpact(e: SimEventOf<'ordnanceImpact'>): void {
    const { x, y } = e.pos;
    const kit = this.kit;
    switch (e.weapon) {
      case 'rocket':
        kit.explosion(x, y, 'small', { scale: Math.max(0.8, e.radius / 36), dirt: true });
        break;
      case 'maverick':
        kit.explosion(x, y, 'medium', { scale: 1.1, dirt: true });
        break;
      case 'bomb':
        kit.explosion(x, y, 'large', { scale: Math.max(0.8, e.radius / 70), crater: true, dirt: true });
        kit.dustRing(x, y, e.radius * 0.7, 18);
        break;
      case 'tankShell':
        kit.flash('ground', x, y, 30, 0.1, 0xffd090, 0.8);
        kit.smoke('ground', x, y, 3, { spread: 4, speed: 30, size0: 6, size1: 24, life: 1.1, alpha: 0.55, ramp: RAMPS.dust });
        kit.debris('ground', x, y, 3, 90, 0x6b5a3e, 3);
        break;
    }
  }

  private entityDestroyed(e: SimEventOf<'entityDestroyed'>): void {
    const { x, y } = e.pos;
    const kit = this.kit;
    if (e.kind === 'infantry' || e.kind === 'friendlyInfantry') {
      // Mechs: a small pop sized to the ~2× walker sprite.
      kit.flash('ground', x, y, 22 * UNIT_FX_SCALE, 0.1, 0xffd090, 0.7);
      kit.smoke('ground', x, y, 4, { spread: 9, speed: 26, size0: 11, size1: 38, life: 1.5, alpha: 0.55, ramp: RAMPS.dust });
      return;
    }
    const big = e.size === 'large' || e.size === 'huge';
    // Explosions scale with the (bigger-than-life) sprites; screen shake keeps its tuning.
    kit.explosion(x, y, e.size, { crater: big, scale: UNIT_FX_SCALE, shakeScale: 1 });
    if (big) this.wrecks.streamers(x, y, e.size === 'huge' ? 7 : 4, e.size === 'huge' ? 340 : 260, 'ground');
    this.wrecks.start(x, y, e.size);
    // Sprawling targets burn in several places.
    if (e.kind === 'ammoDump' || e.kind === 'outpost' || e.kind === 'homeBase') {
      for (let i = 0; i < 3; i++) this.wrecks.start(x + rand(-55, 55), y + rand(-40, 40), 'medium', 0.8);
    } else if (e.kind === 'samSite') {
      this.wrecks.start(x + rand(-18, 18), y + rand(-18, 18), 'small');
    } else if (e.kind === 'bridge') {
      // Spans crashing into the river: white spray.
      kit.smoke('ground', x, y, 14, { spread: 40, speed: 70, size0: 12, size1: 46, life: 1.8, alpha: 0.65, ramp: RAMPS.smokeWhite });
    }
  }

  private groundFire(e: SimEventOf<'groundFire'>): void {
    const kit = this.kit;
    const { from, to } = e;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const heading = Math.atan2(dy, dx);
    const cx = Math.cos(heading);
    const cy = Math.sin(heading);
    if (e.shooterKind === 'tank' || e.shooterKind === 'friendlyTank') {
      const mx = from.x + cx * 14;
      const my = from.y + cy * 14;
      kit.muzzleFlash('ground', mx, my, heading, 24, 0xffd890, 0.07);
      kit.smoke('ground', mx, my, 2, { spread: 3, speed: 18, size0: 5, size1: 22, life: 1.3, alpha: 0.4, ramp: RAMPS.smokeGrey });
      const travel = Math.min(0.5, dist / 1400);
      kit.streak('ground', mx, my, to.x, to.y, travel, 16, 0xffe2a0, 0.55);
      const f = kit.flash('ground', to.x, to.y, 28, 0.12, 0xffc070, 0.8);
      if (f) f.delay = travel;
      this.delayedPuff(to.x, to.y, travel, 16);
    } else {
      const shots = e.shooterKind === 'aaGun' || e.shooterKind === 'mobileAa' ? 3 : 2;
      for (let i = 0; i < shots; i++) {
        const delay = rand(0, 0.18);
        const f = kit.flash('ground', from.x + cx * 5, from.y + cy * 5, 7, 0.05, 0xffe0a0, 0.9);
        if (f) f.delay = delay;
        const ex = to.x + rand(-6, 6);
        const ey = to.y + rand(-6, 6);
        const travel = Math.min(0.35, dist / 1100);
        kit.streak('ground', from.x, from.y, ex, ey, travel, 8, 0xfff0b0, 0.4, delay);
        if (i === 0) this.delayedPuff(ex, ey, delay + travel, 7);
      }
    }
  }

  private delayedPuff(x: number, y: number, delay: number, size: number): void {
    const p = this.kit.layers.groundUnder.spawn('particleSmoke', x, y);
    if (!p) return;
    p.delay = delay;
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
