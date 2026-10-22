import Phaser from 'phaser';
import { GROUND_ROUNDS, groundRoundFor } from '../../config';
import { riverCrossing } from '../../content/levels';
import { EffectsDirector } from '../../render/effects';
import { EntityRenderer } from '../../render/entities';
import { TerrainRenderer } from '../../render/terrain';
import type { Entity } from '../../sim/entities';
import type { Vec2 } from '../../sim/math';
import { spawnFromDefinition } from '../../sim/spawning';
import type { EntityKind } from '../../sim/types';
import { World } from '../../sim/world';
import { withGalleryBiome } from './galleryBiome';

const CENTRE: Vec2 = { x: 3400, y: 2230 };
const ZOOMS = [1.6, 1.0, 0.72, 0.45];
const SPEEDS = [15, 30, 45];
/** Lanes: each drives east ↔ west, units spaced along it. */
const LANES: Array<{ y: number; kinds: EntityKind[] }> = [
  { y: -150, kinds: ['infantry', 'infantry', 'friendlyInfantry', 'friendlyInfantry'] },
  { y: -30, kinds: ['tank', 'friendlyTank', 'tank'] },
  { y: 90, kinds: ['truck', 'mobileAa', 'mlrs'] },
  { y: 190, kinds: ['infantry', 'tank', 'friendlyInfantry', 'friendlyTank'] },
];
const LANE_HALF = 260;
const SPACING = 110;
/** Stop-and-go script: drive this long, then halt (and fire, if armed) before turning round. */
const DRIVE_TIME = 5;
const HALT_TIME = 2.2;
const TURN_TIME = 0.9;
const FIRES: ReadonlySet<EntityKind> = new Set<EntityKind>(['tank', 'friendlyTank', 'infantry', 'friendlyInfantry']);

const HELP = '1-3 speed · Space hold/go · F fire · Z zoom · C restart';

interface Driven {
  entity: Entity;
  dir: 1 | -1;
}

/**
 * Movement cycles test bed (`?view=motion`): real ground units drawn by the game's EntityRenderer,
 * driven back and forth over River Crossing terrain on a stop-and-go script, so the walk / tread frame
 * cycles, the stop-settle and the firing recoil (with the real EffectsDirector's tracers)
 * can be checked at every zoom. Positions are scripted here; the sim's own systems never run.
 */
export class UnitMotionScene extends Phaser.Scene {
  private world: World | null = null;
  private units: Driven[] = [];
  private entityRenderer: EntityRenderer | null = null;
  private director: EffectsDirector | null = null;
  private speedIndex = 1;
  private zoomIndex = 1;
  private held = false;
  /** Seconds into the drive → halt → turn script. */
  private clock = 0;
  private fired = false;
  /** Script loops completed (each one ends with every unit facing the other way). */
  private loops = 0;
  private hintTimer = 0;

  constructor() {
    super('UnitMotion');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.zoomIndex = Math.max(0, ZOOMS.indexOf(Number(params.get('zoom') ?? '1')));
    const cam = this.cameras.main;
    cam.centerOn(CENTRE.x, CENTRE.y + 20);
    cam.setZoom(ZOOMS[this.zoomIndex] ?? 1);

    new TerrainRenderer(this, withGalleryBiome(riverCrossing)).build();
    const world = new World(riverCrossing);
    this.world = world;
    this.units = [];
    for (const lane of LANES) {
      lane.kinds.forEach((kind, i) => {
        const x = CENTRE.x - LANE_HALF + 40 + i * SPACING;
        const entity = spawnFromDefinition(world, { kind, pos: { x, y: CENTRE.y + lane.y } });
        this.units.push({ entity, dir: 1 });
      });
    }
    this.director = new EffectsDirector(this);
    this.entityRenderer = new EntityRenderer(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.entityRenderer?.destroy());

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ONE', () => (this.speedIndex = 0));
      kb.on('keydown-TWO', () => (this.speedIndex = 1));
      kb.on('keydown-THREE', () => (this.speedIndex = 2));
      kb.on('keydown-SPACE', () => (this.held = !this.held));
      kb.on('keydown-F', () => this.fireAll());
      kb.on('keydown-Z', () => (this.zoomIndex = (this.zoomIndex + 1) % ZOOMS.length));
      kb.on('keydown-C', () => this.scene.restart());
    }
  }

  override update(_time: number, delta: number): void {
    const world = this.world;
    if (!world) return;
    const dt = Math.min(delta, 50) / 1000;
    world.time += dt;
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Linear(cam.zoom, ZOOMS[this.zoomIndex] ?? 1, Math.min(1, delta / 250)));

    if (!this.held) this.clock += dt;
    const period = DRIVE_TIME + HALT_TIME + TURN_TIME;
    const loops = Math.floor(this.clock / period);
    if (loops !== this.loops) {
      this.loops = loops;
      for (const unit of this.units) {
        unit.dir = unit.dir === 1 ? -1 : 1;
        unit.entity.heading = unit.dir === 1 ? 0 : Math.PI;
      }
    }
    const t = this.clock % period;
    const driving = !this.held && t < DRIVE_TIME;
    if (t < DRIVE_TIME) this.fired = false;
    if (!driving && !this.held && t >= DRIVE_TIME + HALT_TIME * 0.35 && !this.fired) {
      this.fired = true;
      this.fireAll();
    }
    const turning = !this.held && t >= DRIVE_TIME + HALT_TIME;
    const speed = SPEEDS[this.speedIndex] ?? 30;
    for (const unit of this.units) {
      const e = unit.entity;
      if (driving) e.pos.x += unit.dir * speed * dt;
      if (turning) {
        // Pivot in place to face the other way (no ground covered: the cycles stay still).
        const k = Math.min(1, (t - DRIVE_TIME - HALT_TIME) / TURN_TIME);
        e.heading = (unit.dir === 1 ? 0 : Math.PI) + Math.PI * k;
      }
      e.turretHeading = e.heading;
    }

    const events = world.drainEvents();
    this.director?.handleEvents(events);
    this.director?.update(delta, world);
    this.entityRenderer?.sync(world, events);

    this.hintTimer -= delta;
    if (this.hintTimer <= 0) {
      this.hintTimer = 250;
      const hint = document.getElementById('hint');
      if (hint) {
        const state = this.held ? 'HOLD' : driving ? 'DRIVE' : turning ? 'TURN' : 'HALT';
        hint.textContent = `${Math.round(this.game.loop.actualFps)} fps · ${speed} u/s · zoom ${ZOOMS[this.zoomIndex]} · ${state} | ${HELP}`;
      }
    }
  }

  /** Every armed unit fires a shot ahead (ground-fire tracer + recoil). */
  private fireAll(): void {
    const world = this.world;
    if (!world) return;
    for (const { entity: e } of this.units) {
      if (!FIRES.has(e.kind)) continue;
      const aim = e.turretHeading;
      const to = { x: e.pos.x + Math.cos(aim) * 220, y: e.pos.y + Math.sin(aim) * 220 };
      const round = groundRoundFor(e.kind);
      world.emit({ type: 'groundFire', shooterKind: e.kind, round, from: { ...e.pos }, to, flightTime: 220 / GROUND_ROUNDS[round].speed });
    }
  }
}
