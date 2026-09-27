import Phaser from 'phaser';
import { bandProfileAt } from '../../config';
import type { WorldView } from '../../sim/world';

/** Screen-space look-ahead at zoom 1; scaled by 1/zoom so it grows with altitude. */
const LOOK_AHEAD = 230;
/** Follow stiffness (higher = snappier). */
const FOLLOW_RATE = 4.5;

/** Follows the player with look-ahead in the direction of travel and zooms with altitude. */
export class CameraRig {
  private x = 0;
  private y = 0;

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  snapTo(view: WorldView): void {
    const target = this.target(view);
    this.x = target.x;
    this.y = target.y;
    this.apply(view);
  }

  update(dtMs: number, view: WorldView): void {
    const target = this.target(view);
    const t = 1 - Math.exp((-FOLLOW_RATE * dtMs) / 1000);
    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    this.apply(view);
  }

  private target(view: WorldView): { x: number; y: number } {
    const p = view.player;
    if (!p.alive) return { x: this.x, y: this.y };
    const zoom = bandProfileAt(p.alt).zoom;
    const ahead = LOOK_AHEAD / zoom;
    return { x: p.pos.x + Math.cos(p.heading) * ahead, y: p.pos.y + Math.sin(p.heading) * ahead };
  }

  private apply(view: WorldView): void {
    this.camera.setZoom(bandProfileAt(view.player.alt).zoom);
    this.camera.centerOn(this.x, this.y);
  }
}
