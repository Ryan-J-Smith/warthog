/** What to do when a key already has its maximum number of voices. */
export type VoicePolicy = 'drop' | 'steal';

export interface VoiceCap {
  max: number;
  /** 'drop' ignores the new sound; 'steal' stops the oldest voice of the same key. */
  policy: VoicePolicy;
}

export interface VoiceRequest<V> {
  allow: boolean;
  /** Voice the caller must stop before starting the new one (steal policy). */
  evict: V | null;
}

/**
 * Caps concurrent voices per key (and globally) to avoid mush and clipping.
 * Generic over the voice type; `isActive` tells finished voices apart so they can be pruned.
 */
export class VoiceLimiter<V> {
  private readonly active = new Map<string, V[]>();

  constructor(
    private readonly isActive: (voice: V) => boolean,
    private readonly globalMax: number,
  ) {}

  request(key: string, cap: VoiceCap): VoiceRequest<V> {
    this.prune();
    const list = this.active.get(key) ?? [];
    if (list.length < cap.max && this.total() < this.globalMax) return { allow: true, evict: null };
    if (cap.policy === 'steal' && list.length > 0) {
      const evict = list.shift() ?? null;
      return { allow: true, evict };
    }
    return { allow: false, evict: null };
  }

  register(key: string, voice: V): void {
    const list = this.active.get(key);
    if (list) list.push(voice);
    else this.active.set(key, [voice]);
  }

  count(key: string): number {
    this.prune();
    return this.active.get(key)?.length ?? 0;
  }

  total(): number {
    let n = 0;
    for (const list of this.active.values()) n += list.length;
    return n;
  }

  /** Every tracked voice (active or not yet pruned). */
  all(): V[] {
    return [...this.active.values()].flat();
  }

  clear(): void {
    this.active.clear();
  }

  private prune(): void {
    for (const [key, list] of this.active) {
      const alive = list.filter(this.isActive);
      if (alive.length) this.active.set(key, alive);
      else this.active.delete(key);
    }
  }
}
