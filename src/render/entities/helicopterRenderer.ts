import Phaser from 'phaser';
import { SPRITE_RESOLUTION } from '../../assets';
import { ENTITY_STATS } from '../../config';
import type { Entity } from '../../sim/entities';
import type { SimEvent } from '../../sim/events';
import type { WorldView } from '../../sim/world';
import { DEPTH, heightScale, shadowAlpha, shadowOffset, unitDisplayScale } from '../layers';

const INV_RES = 1 / SPRITE_RESOLUTION;
const FLASH_MS = 70;
/** Drawn a little larger than true size so the gunship reads as a priority target. */
const HELI_SCALE = 1.4;
/** Main rotor spin, radians / s (slows as the wreck falls). */
const ROTOR_SPIN = 15;
/** Seconds for a destroyed helicopter to fall to the ground. */
const FALL_TIME = 0.75;
/** How much the fuselage squashes when banking (sideways) or pitching (forwards) at full speed. */
const BANK_SQUASH = 0.18;
const PITCH_SQUASH = 0.07;

interface HeliVisual {
  body: Phaser.GameObjects.Image;
  rotor: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  rotorShadow: Phaser.GameObjects.Image;
  rotorAngle: number;
  /** Smoothed bank (-1..1) and pitch (0..1). */
  bank: number;
  pitch: number;
  flashUntil: number;
  /** Seconds since death (null while alive); the wreck lands at FALL_TIME. */
  falling: number | null;
  /** Spin picked up on the way down, radians. */
  fallSpin: number;
  landed: boolean;
}

/**
 * Attack helicopters: fuselage + spinning main rotor at flying height, a drop shadow offset like
 * the player's, banking/pitching toward the direction of motion, and a spinning fall to a wreck.
 */
export class HelicopterRenderer {
  private readonly visuals = new Map<number, HeliVisual>();
  private lastMs: number | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  sync(view: WorldView, events: readonly SimEvent[]): void {
    const now = this.scene.time.now;
    const dt = this.lastMs === null ? 0 : Math.min(0.05, Math.max(0, now - this.lastMs) / 1000);
    this.lastMs = now;
    for (const event of events) {
      if (event.type === 'entityDamaged') {
        const visual = this.visuals.get(event.entityId);
        if (visual) visual.flashUntil = now + FLASH_MS;
      }
    }
    const unitScale = unitDisplayScale(this.scene.cameras.main.zoom);
    const live = new Set<number>();
    for (const entity of view.entities) {
      if (!entity.heli) continue;
      live.add(entity.id);
      let visual = this.visuals.get(entity.id);
      if (!visual) {
        if (entity.hidden || !entity.alive) continue;
        visual = this.create(entity);
        this.visuals.set(entity.id, visual);
      }
      this.update(entity, visual, now, dt, unitScale);
    }
    // Helicopters pruned from the world take their sprites (and wrecks) with them.
    for (const [id, visual] of this.visuals) {
      if (live.has(id)) continue;
      destroyVisual(visual);
      this.visuals.delete(id);
    }
  }

  destroy(): void {
    for (const v of this.visuals.values()) destroyVisual(v);
    this.visuals.clear();
  }

  private create(entity: Entity): HeliVisual {
    const { x, y } = entity.pos;
    return {
      shadow: this.scene.add.image(x, y, 'heliBody').setTintFill(0x000000).setDepth(DEPTH.groundFx - 1),
      rotorShadow: this.scene.add.image(x, y, 'heliRotor').setTintFill(0x000000).setDepth(DEPTH.groundFx - 1),
      body: this.scene.add.image(x, y, 'heliBody').setDepth(DEPTH.lowAir + 0.5),
      rotor: this.scene.add.image(x, y, 'heliRotor').setDepth(DEPTH.lowAir + 0.6),
      rotorAngle: entity.id * 1.3,
      bank: 0,
      pitch: 0,
      flashUntil: 0,
      falling: null,
      fallSpin: 0,
      landed: false,
    };
  }

  private update(entity: Entity, v: HeliVisual, now: number, dt: number, unitScale: number): void {
    const heli = entity.heli;
    if (!heli) return;
    if (v.landed) return;
    const stats = ENTITY_STATS[entity.kind].heli;
    const maxSpeed = stats ? stats.maxSpeed : 120;

    if (!entity.alive && v.falling === null) v.falling = 0;
    let height = heli.height;
    let spinRate = ROTOR_SPIN;
    let fade = 1;
    if (v.falling !== null) {
      v.falling += dt;
      const t = Math.min(1, v.falling / FALL_TIME);
      height = heli.height * (1 - t * t);
      spinRate = ROTOR_SPIN * (1 - t * 0.7);
      v.fallSpin += dt * (2 + t * 6);
      fade = 1 - t * 0.4;
      if (t >= 1) {
        this.land(entity, v, unitScale);
        return;
      }
    }

    // Bank toward sideways motion, pitch (nose-down squash) with forward speed.
    const cos = Math.cos(entity.heading);
    const sin = Math.sin(entity.heading);
    const forward = (heli.vel.x * cos + heli.vel.y * sin) / maxSpeed;
    const side = (-heli.vel.x * sin + heli.vel.y * cos) / maxSpeed;
    const k = 1 - Math.exp(-dt * 6);
    v.bank += (Phaser.Math.Clamp(side, -1, 1) - v.bank) * k;
    v.pitch += (Phaser.Math.Clamp(Math.abs(forward), 0, 1) - v.pitch) * k;

    const scale = heightScale(height) * INV_RES * HELI_SCALE * unitScale;
    const sx = scale * (1 - v.pitch * PITCH_SQUASH);
    const sy = scale * (1 - Math.abs(v.bank) * BANK_SQUASH);
    const heading = entity.heading + v.fallSpin;
    // A slight lean into the bank (rolls the fuselage over its sideways motion).
    const lean = v.bank * 3;
    const x = entity.pos.x - sin * lean;
    const y = entity.pos.y + cos * lean;
    v.body.setPosition(x, y).setRotation(heading).setScale(sx, sy).setAlpha(fade);
    v.rotorAngle += spinRate * dt;
    v.rotor.setPosition(x, y).setRotation(v.rotorAngle).setScale(scale).setAlpha(0.9 * fade);

    const off = shadowOffset(height);
    const groundScale = INV_RES * HELI_SCALE * unitScale;
    const alpha = shadowAlpha(height);
    v.shadow
      .setPosition(entity.pos.x + off.x, entity.pos.y + off.y)
      .setRotation(heading)
      .setScale(groundScale, groundScale * (1 - Math.abs(v.bank) * BANK_SQUASH))
      .setAlpha(alpha);
    v.rotorShadow
      .setPosition(entity.pos.x + off.x, entity.pos.y + off.y)
      .setRotation(v.rotorAngle)
      .setScale(groundScale)
      .setAlpha(alpha * 0.45);

    if (v.flashUntil > now && entity.alive) {
      v.body.setTintFill(0xffffff);
    } else {
      v.body.clearTint();
    }
  }

  /** The wreck hits the ground: swap to the crashed sprite under the vehicles, drop the rotor and shadow. */
  private land(entity: Entity, v: HeliVisual, unitScale: number): void {
    v.landed = true;
    v.rotor.setVisible(false);
    v.shadow.setVisible(false);
    v.rotorShadow.setVisible(false);
    const scale = INV_RES * HELI_SCALE * unitScale;
    v.body
      .clearTint()
      .setTexture('heliWreck')
      .setDepth(DEPTH.ground - 0.5)
      .setPosition(entity.pos.x, entity.pos.y)
      .setRotation(entity.heading + v.fallSpin)
      .setScale(scale)
      .setAlpha(1);
  }
}

function destroyVisual(v: HeliVisual): void {
  v.body.destroy();
  v.rotor.destroy();
  v.shadow.destroy();
  v.rotorShadow.destroy();
}
