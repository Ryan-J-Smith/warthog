import type { AudioKey } from '../../src/assets';
import { MusicControl, SoundBackend, SoundVoice, type SoundParams } from '../../src/audio';
import type { MissionOutcome } from '../../src/sim/types';

/** Records everything done to it; `finish()` simulates the sound reaching its end. */
export class FakeVoice extends SoundVoice {
  started = false;
  stopped = false;
  destroyed = false;
  volume: number;
  rate: number;
  pan: number;

  constructor(
    readonly key: AudioKey,
    params: SoundParams,
  ) {
    super();
    this.volume = params.volume;
    this.rate = params.rate ?? 1;
    this.pan = params.pan ?? 0;
  }

  play(): void {
    this.started = true;
    this.stopped = false;
  }
  stop(): void {
    this.stopped = true;
  }
  setVolume(volume: number): void {
    this.volume = volume;
  }
  setRate(rate: number): void {
    this.rate = rate;
  }
  setPan(pan: number): void {
    this.pan = pan;
  }
  get playing(): boolean {
    return this.started && !this.stopped && !this.destroyed;
  }
  destroy(): void {
    this.destroyed = true;
  }
  finish(): void {
    this.stopped = true;
  }
}

export class FakeBackend extends SoundBackend {
  isLocked = false;
  readonly oneShots: FakeVoice[] = [];
  readonly created: FakeVoice[] = [];
  private readonly ticks: ((dtMs: number) => void)[] = [];

  get locked(): boolean {
    return this.isLocked;
  }

  play(key: AudioKey, params: SoundParams): SoundVoice | null {
    const v = new FakeVoice(key, params);
    v.play();
    this.oneShots.push(v);
    return v;
  }

  create(key: AudioKey, params: SoundParams): SoundVoice {
    const v = new FakeVoice(key, params);
    this.created.push(v);
    return v;
  }

  onTick(cb: (dtMs: number) => void): () => void {
    this.ticks.push(cb);
    return () => this.ticks.splice(this.ticks.indexOf(cb), 1);
  }

  tick(dtMs: number): void {
    for (const cb of [...this.ticks]) cb(dtMs);
  }

  /** Simulate every one-shot started so far reaching its end. */
  finishOneShots(): void {
    for (const v of this.oneShots) v.finish();
  }

  played(key: AudioKey): FakeVoice[] {
    return this.oneShots.filter((v) => v.key === key);
  }

  loop(key: AudioKey): FakeVoice | undefined {
    return this.created.filter((v) => v.key === key && v.playing).at(-1);
  }
}

export class FakeMusic extends MusicControl {
  readonly ducks: { level: number; holdMs: number }[] = [];
  readonly stings: MissionOutcome[] = [];

  duck(level: number, holdMs: number): void {
    this.ducks.push({ level, holdMs });
  }
  playSting(outcome: MissionOutcome): void {
    this.stings.push(outcome);
  }
}
