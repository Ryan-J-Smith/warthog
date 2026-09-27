import type Phaser from 'phaser';

/**
 * Distance-aware camera shake. Intensity falls off with distance from the view centre; a new
 * shake only overrides a running one if it is stronger than what is left of it.
 */
export class CameraShaker {
  private current = 0;
  private endsAt = 0;
  private duration = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * @param intensity fraction of the viewport (Phaser convention), e.g. 0.01 = 1 %.
   * @param durationMs shake duration.
   */
  shakeAt(x: number, y: number, intensity: number, durationMs: number): void {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const reach = Math.max(view.width, view.height, 1);
    const d = Math.hypot(x - view.centerX, y - view.centerY);
    if (d > reach * 1.4) return;
    const falloff = Math.min(1, Math.max(0.12, 1.15 - d / reach));
    this.shake(intensity * falloff, durationMs);
  }

  /** Non-positional shake (e.g. the player being hit). */
  shake(intensity: number, durationMs: number): void {
    const cam = this.scene.cameras.main;
    const now = this.scene.time.now;
    const remaining = now < this.endsAt ? this.current * ((this.endsAt - now) / this.duration) : 0;
    if (intensity < remaining * 0.9) return;
    this.current = Math.min(0.03, Math.max(intensity, remaining));
    this.duration = durationMs;
    this.endsAt = now + durationMs;
    cam.shake(durationMs, this.current, true);
  }
}
