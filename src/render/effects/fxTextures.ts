import type Phaser from 'phaser';

/** Runtime-generated textures used by effects (in addition to the SVG particle sprites). */
export const FX_TEXTURES = {
  /** Soft white ring (shockwaves, reveal pings). */
  ring: 'fx.ring',
  /** Long white streak with a bright head at +x (tracers, shell streaks). */
  tracer: 'fx.tracer',
  /** Four-point star burst (muzzle flashes). */
  flash: 'fx.flash',
  /** White disc with a darker rim: tinted, it reads as a coloured ball on light and dark ground. */
  orb: 'fx.orb',
} as const;

/** Create the runtime FX textures on the scene's texture manager if they don't exist yet. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures.exists(FX_TEXTURES.ring)) {
    const size = 128;
    const tex = textures.createCanvas(FX_TEXTURES.ring, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.8, 'rgba(255,255,255,1)');
      g.addColorStop(0.9, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
    }
  }
  if (!textures.exists(FX_TEXTURES.tracer)) {
    const w = 64;
    const h = 8;
    const tex = textures.createCanvas(FX_TEXTURES.tracer, w, h);
    if (tex) {
      const ctx = tex.getContext();
      const body = ctx.createLinearGradient(0, 0, w, 0);
      body.addColorStop(0, 'rgba(255,255,255,0)');
      body.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      body.addColorStop(0.92, 'rgba(255,255,255,1)');
      body.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.ellipse(w * 0.86, h / 2, w * 0.12, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
    }
  }
  if (!textures.exists(FX_TEXTURES.orb)) {
    const size = 32;
    const tex = textures.createCanvas(FX_TEXTURES.orb, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const c = size / 2;
      ctx.fillStyle = 'rgba(70,70,70,1)';
      ctx.beginPath();
      ctx.arc(c, c, c - 1, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createRadialGradient(c - 3, c - 3, 1, c, c, c - 4);
      body.addColorStop(0, 'rgba(255,255,255,1)');
      body.addColorStop(1, 'rgba(225,225,225,1)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(c, c, c - 4, 0, Math.PI * 2);
      ctx.fill();
      tex.refresh();
    }
  }
  if (!textures.exists(FX_TEXTURES.flash)) {
    const size = 64;
    const tex = textures.createCanvas(FX_TEXTURES.flash, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const c = size / 2;
      const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.25, 'rgba(255,255,255,0.7)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      // Long forward spike (+x) and shorter side spikes.
      const spike = (angle: number, len: number, width: number): void => {
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -width);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, width);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      spike(0, c, 4);
      spike(Math.PI / 2, c * 0.55, 3);
      spike(-Math.PI / 2, c * 0.55, 3);
      spike(Math.PI, c * 0.35, 3);
      spike(Math.PI / 4, c * 0.4, 2);
      spike(-Math.PI / 4, c * 0.4, 2);
      tex.refresh();
    }
  }
}
