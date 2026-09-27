import Phaser from 'phaser';
import { SPRITES, SPRITE_RESOLUTION } from '../../assets';
import type { Entity } from '../../sim/entities';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH, unitDisplayScale } from '../layers';
import { ENTITY_VISUALS } from './entityVisuals';

interface EntityVisual {
  base: Phaser.GameObjects.Image;
  top: Phaser.GameObjects.Image | null;
  /** Soft dark ground halo under vehicles (figure/ground separation). */
  halo: Phaser.GameObjects.Image | null;
  wrecked: boolean;
  flashUntil: number;
}

const INV_RES = 1 / SPRITE_RESOLUTION;
const FLASH_MS = 70;
/** Halo diameter relative to the unit's sprite length. */
const HALO_SIZE = 1.9;
const HALO_ALPHA = 0.5;

/** Keeps a sprite (plus optional turret and ground halo) in sync with every ground entity. */
export class EntityRenderer {
  private readonly visuals = new Map<number, EntityVisual>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(view: WorldView, events: readonly SimEvent[]): void {
    const now = this.scene.time.now;
    for (const event of events) {
      if (event.type === 'entityDamaged') {
        const visual = this.visuals.get(event.entityId);
        if (visual) visual.flashUntil = now + FLASH_MS;
      }
    }

    const unitScale = unitDisplayScale(this.scene.cameras.main.zoom);
    for (const entity of view.entities) {
      let visual = this.visuals.get(entity.id);
      if (!visual) {
        if (entity.hidden || !entity.alive) continue;
        visual = this.create(entity);
        this.visuals.set(entity.id, visual);
      }
      this.update(entity, visual, now, unitScale);
    }
  }

  destroy(): void {
    for (const v of this.visuals.values()) {
      v.base.destroy();
      v.top?.destroy();
      v.halo?.destroy();
    }
    this.visuals.clear();
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
    return { base, top, halo, wrecked: false, flashUntil: 0 };
  }

  private update(entity: Entity, visual: EntityVisual, now: number, unitScale: number): void {
    const spec = ENTITY_VISUALS[entity.kind];
    const { base, top, halo } = visual;
    const scale = spec.structure ? INV_RES : INV_RES * unitScale;
    base.setVisible(!entity.hidden);
    base.setPosition(entity.pos.x, entity.pos.y).setRotation(entity.heading).setScale(scale);
    if (top) {
      const topHeading = entity.sam ? entity.sam.launcherHeading : entity.turretHeading;
      top
        .setVisible(!entity.hidden && entity.alive)
        .setPosition(entity.pos.x, entity.pos.y)
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
      base.setTintFill(0xffffff);
      top?.setTintFill(0xffffff);
    } else {
      base.clearTint();
      top?.clearTint();
    }
  }
}
