/** Create a detached 2D canvas of the given pixel size. */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

/** Get a 2D context or throw (canvas 2D is required for terrain baking). */
export function context2d(canvas: HTMLCanvasElement, willReadFrequently = false): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return ctx;
}

/** Uniform-grid spatial index of item indices, keyed by the item's centre. */
export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly cols: number;

  constructor(
    private readonly cellSize: number,
    worldWidth: number,
  ) {
    this.cols = Math.ceil(worldWidth / cellSize) + 4;
  }

  private key(cx: number, cy: number): number {
    return (cy + 2) * this.cols + (cx + 2);
  }

  insert(index: number, x: number, y: number): void {
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const list = this.cells.get(k);
    if (list) list.push(index);
    else this.cells.set(k, [index]);
  }

  /** Call `visit` for every item whose centre lies in the rectangle grown by `pad`. */
  query(x: number, y: number, w: number, h: number, pad: number, visit: (index: number) => void): void {
    const c0 = Math.floor((x - pad) / this.cellSize);
    const c1 = Math.floor((x + w + pad) / this.cellSize);
    const r0 = Math.floor((y - pad) / this.cellSize);
    const r1 = Math.floor((y + h + pad) / this.cellSize);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const i of list) visit(i);
      }
    }
  }
}

/** Integer hash of a 2D cell + seed → [0, 1). Used for stateless per-cell scatter. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
