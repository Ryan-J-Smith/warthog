import { riverCrossing } from '../../content/levels';
import type { Projectile, PlayerState } from '../../sim/entities';
import type { SimEvent } from '../../sim/events';
import { NO_INPUT } from '../../sim/input';
import type { EntitySpawn } from '../../sim/level';
import type { Vec2 } from '../../sim/math';
import { spawnFromDefinition } from '../../sim/spawning';
import { SpottingSystem, WeaponSystem, initObjectives } from '../../sim/systems';
import type { ProjectileKind } from '../../sim/types';
import { World } from '../../sim/world';
import type { WorldView } from '../../sim/world';

/** Extra bookkeeping the fake simulator needs per projectile. */
interface FakeProjectile extends Projectile {
  /** Where a ballistic/straight projectile ends (null = homing / free). */
  end: Vec2 | null;
  endAlt: number;
  flightTime: number;
  speed: number;
  /** Homing target position provider. */
  homing: (() => Vec2) | null;
  onArrive: ((p: FakeProjectile) => void) | null;
  decoyedTo: FakeProjectile | null;
  /** SAM acceleration override (u/s²). */
  accel?: number;
}

function makePlayer(pos: Vec2): PlayerState {
  return {
    pos,
    heading: 0,
    alt: 0,
    targetBand: 'low',
    band: 'low',
    speed: 200,
    energy: 1,
    turnInput: 0,
    turnRate: 0,
    hp: 100,
    maxHp: 100,
    shield: 60,
    maxShield: 60,
    shieldRegenIn: 0,
    boost: 3,
    maxBoost: 3,
    boosting: false,
    braking: false,
    boostFree: 0,
    overdrive: 0,
    lives: 3,
    alive: true,
    invulnerable: 0,
    respawnIn: 0,
    selectedWeapon: 'gun',
    ammo: { gun: 1150, rockets: 8, maverick: 4, bombs: 6 },
    flares: 8,
    firing: false,
    gunDip: 0,
    rearm: 0,
    lockTargetId: null,
    lockProgress: 0,
    missilesTracking: 0,
    radarLocks: 0,
  };
}

/**
 * A toy stand-in for the simulation, just enough to drive the gallery's EffectsDirector, entity
 * renderer, targeting overlays and HUD: a plane flying circles, projectiles that fly/home/fall, and
 * the events they would emit.
 *
 * The view is a real sim `World` for River Crossing (level entities + objectives, plus any extra
 * staged units), so every renderer reads genuine state. The real `WeaponSystem` (never firing)
 * computes the reticle, weapon availability and Maverick lock; the real `SpottingSystem` spots
 * units for IFF markers and threat rings. Everything else is scripted by the gallery.
 */
export class FakeBattle {
  readonly player: PlayerState;
  readonly projectiles: FakeProjectile[] = [];
  /** Mutable world state (scenarios poke it); renderers read it as `world`. */
  readonly state: World;
  readonly world: WorldView;
  private events: SimEvent[] = [];
  private readonly timers: Array<{ at: number; fn: () => void }> = [];
  private readonly weapons = new WeaponSystem();
  private readonly spotting = new SpottingSystem();
  private nextId = 1;
  private orbitAngle = 0;
  /** Current orbit radius (eases back to `orbitRadius` after an attack run). */
  private radius: number;
  /** Straight attack run toward a target, until sim time `until`. */
  private run: { until: number; target: Vec2 } | null = null;

  constructor(
    readonly centre: Vec2,
    private readonly orbitRadius: number,
    extraUnits: readonly EntitySpawn[] = [],
  ) {
    this.player = makePlayer({ x: centre.x + orbitRadius, y: centre.y });
    this.player.heading = Math.PI / 2;
    this.radius = orbitRadius;
    this.state = new World(riverCrossing);
    for (const spawn of riverCrossing.entities) spawnFromDefinition(this.state, spawn);
    for (const spawn of extraUnits) spawnFromDefinition(this.state, spawn);
    initObjectives(this.state);
    this.state.player = this.player;
    this.state.projectiles = this.projectiles;
    this.world = this.state;
  }

  /** Events produced since the last call (scripted ones + those from the real systems). */
  drain(): SimEvent[] {
    const out = this.events.concat(this.state.drainEvents());
    this.events = [];
    return out;
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Altitude the plane flies at (0 Low, 1 Medium, 2 High). */
  setAltitude(alt: number): void {
    this.player.alt = alt;
    this.player.band = alt < 0.5 ? 'low' : alt < 1.5 ? 'medium' : 'high';
  }

  /** Turn onto `target` and fly straight at it for `seconds` (gun, rocket, Maverick, bomb runs). */
  attackRun(target: Vec2, seconds: number): void {
    this.run = { until: this.state.time + seconds, target: { ...target } };
  }

  /** Run `fn` after `delay` seconds of simulated time. */
  later(delay: number, fn: () => void): void {
    this.timers.push({ at: this.state.time + delay, fn });
  }

  step(dt: number): void {
    this.state.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t && t.at <= this.state.time) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }
    this.fly(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p) continue;
      p.age += dt;
      if (this.advance(p, dt)) {
        this.projectiles.splice(i, 1);
        p.onArrive?.(p);
      } else if (p.age >= p.life) {
        this.projectiles.splice(i, 1);
        if (p.kind === 'samMissile') this.emit({ type: 'samDetonated', missileId: p.id, pos: { ...p.pos }, hitPlayer: false });
      }
    }

    // RWR: SAMs still homing on the player (not decoyed).
    this.player.missilesTracking = this.projectiles.filter((p) => p.kind === 'samMissile' && !p.decoyedTo).length;
    // Real reticle / weapon availability / Maverick lock, and real spotting (IFF + rings).
    const ctx = { world: this.state, dt, input: NO_INPUT };
    this.weapons.update(ctx);
    this.spotting.update(ctx);
  }

  /** Orbit the centre clockwise, or fly an attack run; the heading turns smoothly (with bank). */
  private fly(dt: number): void {
    const p = this.player;
    const speed = 200;
    let desired: number;
    if (this.run && this.state.time < this.run.until) {
      desired = Math.atan2(this.run.target.y - p.pos.y, this.run.target.x - p.pos.x);
      p.pos.x += Math.cos(p.heading) * speed * dt;
      p.pos.y += Math.sin(p.heading) * speed * dt;
    } else {
      if (this.run) {
        // Rejoin the orbit from wherever the run ended.
        this.run = null;
        this.orbitAngle = Math.atan2(p.pos.y - this.centre.y, p.pos.x - this.centre.x);
        this.radius = Math.max(60, Math.hypot(p.pos.x - this.centre.x, p.pos.y - this.centre.y));
      }
      this.radius += (this.orbitRadius - this.radius) * Math.min(1, dt * 0.8);
      this.orbitAngle += (speed / this.radius) * dt;
      p.pos.x = this.centre.x + Math.cos(this.orbitAngle) * this.radius;
      p.pos.y = this.centre.y + Math.sin(this.orbitAngle) * this.radius;
      desired = this.orbitAngle + Math.PI / 2;
    }
    const diff = Math.atan2(Math.sin(desired - p.heading), Math.cos(desired - p.heading));
    const turn = Math.max(-3 * dt, Math.min(3 * dt, diff));
    p.heading += turn;
    p.turnInput = Math.max(-1, Math.min(1, turn / dt / 1.5));
    p.speed = speed;
  }

  /** Returns true when the projectile has arrived (and should be removed). */
  private advance(p: FakeProjectile, dt: number): boolean {
    if (p.kind === 'flare') {
      const k = Math.exp(-2.2 * dt);
      p.vel.x *= k;
      p.vel.y *= k;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.alt = Math.max(0, p.alt - 0.45 * dt);
      return false;
    }
    if (p.homing) {
      const target = p.decoyedTo ? p.decoyedTo.pos : p.homing();
      if (p.kind === 'samMissile') p.speed = Math.min(700, p.speed + (p.accel ?? 600) * dt);
      const desired = Math.atan2(target.y - p.pos.y, target.x - p.pos.x);
      let d = desired - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = (p.kind === 'samMissile' ? 2.2 : 3) * dt;
      p.heading += Math.max(-turn, Math.min(turn, d));
      p.vel.x = Math.cos(p.heading) * p.speed;
      p.vel.y = Math.sin(p.heading) * p.speed;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.alt += (p.endAlt - p.alt) * Math.min(1, dt * 1.5);
      return Math.hypot(target.x - p.pos.x, target.y - p.pos.y) < 14;
    }
    // Straight / ballistic.
    const t = Math.min(1, p.age / p.flightTime);
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.alt = p.startAlt + (p.endAlt - p.startAlt) * (p.kind === 'bomb' ? t * t : t);
    return t >= 1;
  }

  private spawn(kind: ProjectileKind, pos: Vec2, heading: number, speed: number, extra: Partial<FakeProjectile>): FakeProjectile {
    const p: FakeProjectile = {
      id: this.nextId++,
      kind,
      team: kind === 'samMissile' || kind === 'aaRound' || kind === 'tankShell' ? 'enemy' : 'friendly',
      pos: { ...pos },
      vel: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
      heading,
      alt: 0,
      age: 0,
      life: 10,
      targetId: null,
      lostLock: false,
      aimPoint: null,
      damage: 0,
      splashRadius: 0,
      sourceId: null,
      startDistance: 0,
      end: null,
      startAlt: 0,
      endAlt: 0,
      flightTime: 1,
      speed,
      homing: null,
      onArrive: null,
      decoyedTo: null,
      ...extra,
    };
    this.projectiles.push(p);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Scripted actions
  // ---------------------------------------------------------------------------

  /** Straight-line flight from `from` to `to`, arriving after `time` seconds. */
  shoot(kind: ProjectileKind, from: Vec2, to: Vec2, time: number, startAlt: number, endAlt: number, onArrive: ((p: FakeProjectile) => void) | null): void {
    const heading = Math.atan2(to.y - from.y, to.x - from.x);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.spawn(kind, from, heading, dist / time, { startAlt, endAlt, alt: startAlt, flightTime: time, life: time + 1, end: { ...to }, onArrive });
  }

  rocketSalvo(): void {
    const pl = this.player;
    const h = pl.heading;
    this.emit({ type: 'rocketLaunched', pos: { ...pl.pos }, heading: h });
    for (let i = 0; i < 3; i++) {
      const side = (i - 1) * 7;
      const from = { x: pl.pos.x - Math.sin(h) * side, y: pl.pos.y + Math.cos(h) * side };
      const to = { x: from.x + Math.cos(h) * 260 + (Math.random() - 0.5) * 16, y: from.y + Math.sin(h) * 260 + (Math.random() - 0.5) * 16 };
      this.shoot('rocket', from, to, 0.55 + i * 0.04, pl.alt + 0.35, 0, (p) =>
        this.emit({ type: 'ordnanceImpact', weapon: 'rocket', pos: { ...p.pos }, radius: 36 }),
      );
    }
  }

  maverick(target: Vec2): void {
    const pl = this.player;
    this.emit({ type: 'missileLaunched', pos: { ...pl.pos }, heading: pl.heading });
    this.spawn('maverick', pl.pos, pl.heading, 520, {
      alt: pl.alt + 0.35,
      endAlt: 0,
      life: 6,
      homing: () => target,
      onArrive: (p) => {
        this.emit({ type: 'ordnanceImpact', weapon: 'maverick', pos: { ...p.pos }, radius: 30 });
        this.emit({ type: 'entityDestroyed', entityId: 0, kind: 'tank', team: 'enemy', pos: { ...target }, size: 'medium' });
        this.emit({ type: 'scoreAwarded', points: 300, reason: 'Tank', pos: { ...target } });
      },
    });
  }

  bombs(): void {
    const pl = this.player;
    this.emit({ type: 'bombReleased', pos: { ...pl.pos } });
    for (let i = 0; i < 3; i++) {
      const lead = 190 + i * 26;
      const from = { x: pl.pos.x - Math.cos(pl.heading) * i * 26, y: pl.pos.y - Math.sin(pl.heading) * i * 26 };
      const to = { x: from.x + Math.cos(pl.heading) * lead, y: from.y + Math.sin(pl.heading) * lead };
      this.shoot('bomb', from, to, 1.1 + i * 0.12, Math.max(1, pl.alt) + 0.35, 0, (p) =>
        this.emit({ type: 'ordnanceImpact', weapon: 'bomb', pos: { ...p.pos }, radius: 70 }),
      );
    }
  }

  /** SAM launch at the player; `accel` (u/s²) lets the gallery slow the intercept to show the RWR. */
  samLaunch(site: Vec2, accel = 600): void {
    const missile = this.spawn('samMissile', site, Math.atan2(this.player.pos.y - site.y, this.player.pos.x - site.x), 120, {
      accel,
      alt: 0,
      endAlt: Math.max(1, this.player.alt) + 0.35,
      life: 6,
      homing: () => this.player.pos,
      onArrive: (p) => {
        const hit = !p.decoyedTo;
        this.emit({ type: 'samDetonated', missileId: p.id, pos: { ...p.pos }, hitPlayer: hit });
        if (hit) this.emit({ type: 'playerHit', pos: { ...this.player.pos }, damage: 55, source: 'sam' });
      },
    });
    this.emit({ type: 'samLaunched', siteId: 0, missileId: missile.id, pos: { ...site } });
  }

  flares(): void {
    const pl = this.player;
    this.emit({ type: 'flareDeployed', pos: { ...pl.pos } });
    const flares: FakeProjectile[] = [];
    for (let i = 0; i < 4; i++) {
      const a = pl.heading + Math.PI + (i - 1.5) * 0.45;
      flares.push(this.spawn('flare', pl.pos, a, 190 + Math.random() * 60, { alt: pl.alt + 0.35, life: 3.2 }));
    }
    for (const p of this.projectiles) {
      if (p.kind !== 'samMissile' || p.decoyedTo || Math.random() > 0.75) continue;
      const decoy = flares[Math.floor(Math.random() * flares.length)] ?? null;
      p.decoyedTo = decoy;
      p.lostLock = true;
      this.emit({ type: 'samDecoyed', missileId: p.id, pos: { ...p.pos } });
    }
  }

  aaBurst(gun: Vec2): void {
    this.emit({ type: 'aaBurst', entityId: 0, pos: { ...gun } });
    const pl = this.player;
    for (let i = 0; i < 12; i++) {
      const delay = i * 0.05;
      const lead = 0.55 + delay;
      const aim = {
        x: pl.pos.x + Math.cos(pl.heading) * pl.speed * lead + (Math.random() - 0.5) * 60,
        y: pl.pos.y + Math.sin(pl.heading) * pl.speed * lead + (Math.random() - 0.5) * 60,
      };
      const dist = Math.hypot(aim.x - gun.x, aim.y - gun.y);
      this.later(delay, () => this.shoot('aaRound', gun, aim, dist / 900, 0, pl.alt + 0.35, null));
    }
  }

  tankShot(from: Vec2, to: Vec2): void {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.shoot('tankShell', from, to, dist / 1400, 0.05, 0, (p) => this.emit({ type: 'ordnanceImpact', weapon: 'tankShell', pos: { ...p.pos }, radius: 12 }));
  }
}
