import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { SpriteKey } from '../../assets';
import type { Entity } from '../../sim/entities';
import type { SimEvent } from '../../sim/events';
import type { Vec2 } from '../../sim/math';
import type { WorldView } from '../../sim/world';
import { DEPTH, unitDisplayScale } from '../layers';
import { UnitMotion } from '../motion';
import { ENTITY_VISUALS } from './entityVisuals';
import { HelicopterRenderer } from './helicopterRenderer';

interface EntityVisual {
  base: Phaser.GameObjects.Image;
  top: Phaser.GameObjects.Image | null;
  /** Soft dark ground halo under vehicles (figure/ground separation). */
  halo: Phaser.GameObjects.Image | null;
  wrecked: boolean;
  flashUntil: number;
  /** Walk / tread frame cycle and firing recoil (units with a `motion` spec). */
  motion: UnitMotion | null;
  /** Texture currently on `base` while alive (the motion cycle swaps frames). */
  frame: SpriteKey;
}

const INV_RES = 1 / SPRITE_RESOLUTION;

function destroyVisual(visual: EntityVisual): void {
  visual.base.destroy();
  visual.top?.destroy();
  visual.halo?.destroy();
}
const FLASH_MS = 70;
/** Hit tint for structures (vehicles flash white instead). */
const STRUCTURE_HIT_TINT = 0xffa090;
/** Halo diameter relative to the unit's sprite length. */
const HALO_SIZE = 1.9;
const HALO_ALPHA = 0.5;
/** A `groundFire` event belongs to the nearest unit of its kind within this distance of `from`. */
const SHOOTER_MATCH_RADIUS = 12;

/** Keeps a sprite (plus optional turret and ground halo) in sync with every ground entity. */
export class EntityRenderer {
  private readonly visuals = new Map<number, EntityVisual>();
  /** Airborne units (helicopters) have their own renderer. */
  private readonly helicopters: HelicopterRenderer;
  private lastMs: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.helicopters = new HelicopterRenderer(scene);
  }

  sync(view: WorldView, events: readonly SimEvent[]): void {
    const now = this.scene.time.now;
    const dt = this.lastMs === null ? 0 : Math.min(0.1, Math.max(0, now - this.lastMs) / 1000);
    this.lastMs = now;
    for (const event of events) {
      if (event.type === 'entityDamaged') {
        const visual = this.visuals.get(event.entityId);
        if (visual) visual.flashUntil = now + FLASH_MS;
      } else if (event.type === 'groundFire') {
        this.recoil(view, event.shooterKind, event.from, event.to);
      }
    }

    this.helicopters.sync(view, events);
    const unitScale = unitDisplayScale(this.scene.cameras.main.zoom);
    const live = new Set<number>();
    for (const entity of view.entities) {
      live.add(entity.id);
      if (ENTITY_VISUALS[entity.kind].airborne) continue;
      let visual = this.visuals.get(entity.id);
      if (!visual) {
        if (entity.hidden || !entity.alive) continue;
        visual = this.create(entity);
        this.visuals.set(entity.id, visual);
      }
      this.update(entity, visual, now, dt, unitScale);
    }
    // Entities pruned from the world (expired wave wrecks, escaped convoys) take their sprites with them.
    for (const [id, visual] of this.visuals) {
      if (live.has(id)) continue;
      destroyVisual(visual);
      this.visuals.delete(id);
    }
  }

  destroy(): void {
    for (const v of this.visuals.values()) destroyVisual(v);
    this.visuals.clear();
    this.helicopters.destroy();
  }

  private create(entity: Entity): EntityVisual {
    const spec = ENTITY_VISUALS[entity.kind];
    const depth = spec.structure ? DEPTH.ground - 2 : DEPTH.ground;
    const base = this.scene.add.image(entity.pos.x, entity.pos.y, spec.base).setScale(INV_RES).setDepth(depth);
    const top = spec.top
      ? this.scene.add
          .image(entity.pos.x, entity.pos.y, spec.top)
          .setScale(INV_RES)
          .setOrigin(spec.topOrigin.x, spec.topOrigin.y)
          .setDepth(depth + 0.5)
      : null;
    const halo = spec.structure
      ? null
      : this.scene.add
          .image(entity.pos.x, entity.pos.y, 'particleSoft')
          .setTintFill(0x000000)
          .setAlpha(HALO_ALPHA)
          .setDepth(DEPTH.groundShadows);
    const motion = spec.motion ? new UnitMotion(spec.motion, entity.id) : null;
    return { base, top, halo, wrecked: false, flashUntil: 0, motion, frame: spec.base };
  }

  /** Kick the turret (or a walker's body) of the unit that fired a `groundFire` shot. */
  private recoil(view: WorldView, kind: Entity['kind'], from: Vec2, to: Vec2): void {
    let best: EntityVisual | null = null;
    let bestDist = SHOOTER_MATCH_RADIUS;
    for (const entity of view.entities) {
      if (entity.kind !== kind || !entity.alive) continue;
      const d = Math.hypot(entity.pos.x - from.x, entity.pos.y - from.y);
      const visual = this.visuals.get(entity.id);
      if (d <= bestDist && visual) {
        best = visual;
        bestDist = d;
      }
    }
    best?.motion?.fire(Math.atan2(to.y - from.y, to.x - from.x));
  }

  private update(entity: Entity, visual: EntityVisual, now: number, dt: number, unitScale: number): void {
    const spec = ENTITY_VISUALS[entity.kind];
    const { base, top, halo } = visual;
    const scale = spec.structure ? INV_RES : INV_RES * unitScale;
    // Walk / tread frame cycle and recoil kick, while alive; wrecks sit still.
    const pose = visual.motion && entity.alive ? visual.motion.update(entity.pos, dt, unitScale) : null;
    if (pose && spec.motion) {
      const frame = spec.motion.frames[pose.frame] ?? spec.base;
      if (frame !== visual.frame) {
        visual.frame = frame;
        base.setTexture(frame);
      }
    }
    base.setVisible(!entity.hidden);
    base
      .setPosition(entity.pos.x + (pose?.baseX ?? 0), entity.pos.y + (pose?.baseY ?? 0))
      .setRotation(entity.heading)
      .setScale(scale);
    if (top) {
      const topHeading = entity.sam ? entity.sam.launcherHeading : entity.turretHeading;
      top
        .setVisible(!entity.hidden && entity.alive)
        .setPosition(entity.pos.x + (pose?.topX ?? 0), entity.pos.y + (pose?.topY ?? 0))
        .setRotation(topHeading)
        .setScale(scale);
    }
    if (halo) {
      // particleSoft is 32 world units natively.
      const diameter = SPRITES[spec.base].w * HALO_SIZE * unitScale;
      halo
        .setVisible(!entity.hidden && entity.alive)
        .setPosition(entity.pos.x, entity.pos.y)
        .setScale((diameter / SPRITES.particleSoft.w) * INV_RES);
    }

    if (!entity.alive && !visual.wrecked) {
      visual.wrecked = true;
      top?.setVisible(false);
      halo?.setVisible(false);
      if (spec.wreck) {
        base.setTexture(spec.wreck).setDepth(base.depth - 0.5);
      } else {
        this.scene.tweens.add({ targets: base, alpha: 0, duration: 600, onComplete: () => base.setVisible(false) });
      }
    }

    if (visual.flashUntil > now && entity.alive) {
      if (spec.structure) {
        // Big structures (e.g. the outpost under constant ground fire) get a soft warm tint;
        // a full white fill turns their whole footprint into a white square.
        base.setTint(STRUCTURE_HIT_TINT);
      } else {
        base.setTintFill(0xffffff);
        top?.setTintFill(0xffffff);
      }
    } else {
      base.clearTint();
      top?.clearTint();
    }
  }
}
