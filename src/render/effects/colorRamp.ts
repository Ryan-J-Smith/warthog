/** A precomputed colour gradient over normalised life t ∈ [0, 1], for particle tinting. */
export class ColorRamp {
  private readonly table: Uint32Array;

  /** `stops` = [t, 0xRRGGBB] pairs in ascending t. */
  constructor(stops: ReadonlyArray<readonly [number, number]>, steps = 48) {
    this.table = new Uint32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      let a = stops[0] ?? [0, 0xffffff];
      let b = stops[stops.length - 1] ?? a;
      for (let k = 0; k < stops.length - 1; k++) {
        const s0 = stops[k];
        const s1 = stops[k + 1];
        if (s0 && s1 && t >= s0[0] && t <= s1[0]) {
          a = s0;
          b = s1;
          break;
        }
      }
      const span = b[0] - a[0];
      const f = span > 0 ? Math.min(1, Math.max(0, (t - a[0]) / span)) : 0;
      this.table[i] = lerpColor(a[1], b[1], f);
    }
  }

  /** Colour at t (clamped). */
  at(t: number): number {
    const n = this.table.length;
    const i = t <= 0 ? 0 : t >= 1 ? n - 1 : Math.floor(t * (n - 1));
    return this.table[i] ?? 0xffffff;
  }
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** Shared ramps. */
export const RAMPS = {
  /** Additive hot core: brief white, then deep orange. */
  fire: new ColorRamp([
    [0, 0xfff4d6],
    [0.07, 0xffd070],
    [0.22, 0xff8a26],
    [0.45, 0xc9460f],
    [0.72, 0x5a1a06],
    [1, 0x1e0802],
  ]),
  /** Normal-blend fire body: orange billows that char into smoke. */
  fireBody: new ColorRamp([
    [0, 0xffc45a],
    [0.18, 0xf5821f],
    [0.38, 0xb8451a],
    [0.6, 0x4a2a1c],
    [0.8, 0x2c2622],
    [1, 0x3a3530],
  ]),
  /** Fire that starts already orange (lingering flames on wrecks). */
  flame: new ColorRamp([
    [0, 0xffe38a],
    [0.3, 0xff9a2a],
    [0.7, 0xd4480f],
    [1, 0x501408],
  ]),
  smokeDark: new ColorRamp([
    [0, 0x221e1a],
    [0.5, 0x37322d],
    [1, 0x5a554e],
  ]),
  smokeColumn: new ColorRamp([
    [0, 0x2a2521],
    [0.35, 0x2f2b28],
    [1, 0x6a655d],
  ]),
  smokeGrey: new ColorRamp([
    [0, 0xd8d4cc],
    [1, 0x9c978e],
  ]),
  smokeWhite: new ColorRamp([
    [0, 0xffffff],
    [1, 0xd6d8da],
  ]),
  /** Earth thrown up by ordnance hitting open ground. */
  dirt: new ColorRamp([
    [0, 0x5e4f3c],
    [0.35, 0x8c7b5e],
    [1, 0xb4a484],
  ]),
  flak: new ColorRamp([
    [0, 0x3a3632],
    [1, 0x6e6a64],
  ]),
  dust: new ColorRamp([
    [0, 0xd5c197],
    [1, 0xae9c76],
  ]),
  spark: new ColorRamp([
    [0, 0xffffff],
    [0.25, 0xffe68a],
    [0.65, 0xff9a36],
    [1, 0xb0380f],
  ]),
  tracer: new ColorRamp([
    [0, 0xffffe0],
    [1, 0xffb040],
  ]),
  aaTracer: new ColorRamp([
    [0, 0xffd27a],
    [1, 0xff5a1e],
  ]),
  reveal: new ColorRamp([
    [0, 0xffffff],
    [1, 0x6fe0ff],
  ]),
} as const;
