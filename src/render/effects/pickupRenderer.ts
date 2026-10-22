import Phaser from 'phaser';
import type { SimEvent } from '../../sim/events';
import type { PickupKind } from '../../sim/types';
import type { WorldView } from '../../sim/world';
import { DEPTH } from '../layers';
import type { FloatingTexts } from './floatingText';
import type { FxKit } from './fxKit';

/** Sprite key, accent colour, fallback glyph and pickup callout per kind. */
const LOOK: Record<PickupKind, { sprite: string; color: number; glyph: string; label: string }> = {
  ammo: { sprite: 'pickupAmmo', color: 0xffc23a, glyph: 'A', label: 'AMMO' },
  repair: { sprite: 'pickupRepair', color: 0x5cff8a, glyph: '+', label: 'REPAIR' },
  boost: { sprite: 'pickupBoost', color: 0x52d6ff, glyph: '»', label: 'AFTERBURNER' },
  overdrive: { sprite: 'pickupOverdrive', color: 0xff5a2a, glyph: '!', label: 'GUN OVERDRIVE' },
};

/** World size of a pickup, before the zoom readability boost. */
const SIZE = 44;
/** Blink during the last seconds before expiry. */
const BLINK_TIME = 4;

interface Shown {
  icon: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
  kind: PickupKind;
}

/**
 * Pickups: a bobbing icon with a pulsing additive halo, scaled up at altitude so they read from
 * Medium, blinking before they expire; a burst and a callout when collected.
 */
export class PickupRenderer {
  private readonly shown = new Map<number, Shown>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly kit: FxKit,
    private readonly texts: FloatingTexts,
  ) {
    for (const kind of Object.keys(LOOK) as PickupKind[]) ensureFallback(scene, kind);
  }

  handleEvent(e: SimEvent): void {
    if (e.type === 'pickupCollected') {
      const look = LOOK[e.kind];
      this.kit.ring('air', e.pos.x, e.pos.y, 20, 120, 0.35, look.color, 0.9, true);
      this.kit.flash('air', e.pos.x, e.pos.y, 70, 0.18, look.color, 0.9);
      this.kit.sparks('air', e.pos.x, e.pos.y, 10, 90, 260, 0.4, 10);
      this.texts.spawn(e.pos.x, e.pos.y - 30, look.label, true);
    } else if (e.type === 'pickupSpawned') {
      this.kit.ring('ground', e.pos.x, e.pos.y, 10, 70, 0.4, LOOK[e.kind].color, 0.7, true);
    }
  }

  update(view: WorldView): void {
    const zoom = this.scene.cameras.main.zoom;
    // Keep them readable when zoomed out (Medium/High), without shrinking at Low.
    const boost = Math.max(1, 0.85 / zoom);
    const t = view.time;
    const live = new Set<number>();
    for (const pickup of view.pickups) {
      live.add(pickup.id);
      let s = this.shown.get(pickup.id);
      if (!s) {
        s = this.create(pickup.kind);
        this.shown.set(pickup.id, s);
      }
      const age = t - pickup.spawnedAt;
      const pop = Math.min(1, age / 0.25);
      const bob = Math.sin(t * 4 + pickup.id) * 4;
      const size = SIZE * boost * (0.4 + 0.6 * pop) * (1 + Math.sin(t * 6) * 0.04);
      const left = pickup.expiresAt - t;
      const visible = left > BLINK_TIME || Math.floor(left * 6) % 2 === 0;
      s.icon.setPosition(pickup.pos.x, pickup.pos.y + bob).setDisplaySize(size, size).setVisible(visible);
      s.halo
        .setPosition(pickup.pos.x, pickup.pos.y + bob)
        .setDisplaySize(size * 2.4, size * 2.4)
        .setAlpha(0.35 + Math.sin(t * 5 + pickup.id) * 0.15)
        .setVisible(visible);
    }
    for (const [id, s] of this.shown) {
      if (live.has(id)) continue;
      s.icon.destroy();
      s.halo.destroy();
      this.shown.delete(id);
    }
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      s.icon.destroy();
      s.halo.destroy();
    }
    this.shown.clear();
  }

  private create(kind: PickupKind): Shown {
    const look = LOOK[kind];
    const key = this.scene.textures.exists(look.sprite) ? look.sprite : fallbackKey(kind);
    const halo = this.scene.add
      .image(0, 0, 'particleSoft')
      .setTint(look.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.lowAir - 1);
    const icon = this.scene.add.image(0, 0, key).setDepth(DEPTH.lowAir);
    return { icon, halo, kind };
  }
}

function fallbackKey(kind: PickupKind): string {
  return `fx.pickup.${kind}`;
}

/** A simple outlined token, used until the pickup sprites exist. */
function ensureFallback(scene: Phaser.Scene, kind: PickupKind): void {
  const key = fallbackKey(kind);
  if (scene.textures.exists(key)) return;
  const size = 96;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = size / 2;
  const look = LOOK[kind];
  ctx.fillStyle = '#15120c';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `#${look.color.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.arc(c, c, c - 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#15120c';
  ctx.font = 'bold 54px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(look.glyph, c, c + 3);
  tex.refresh();
}
