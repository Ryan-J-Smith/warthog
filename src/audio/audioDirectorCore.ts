import type { AudioKey } from '../assets';
import type { SimEvent } from '../sim/events';
import type { Vec2 } from '../sim/math';
import type { ExplosionSize, MissionOutcome } from '../sim/types';
import type { WorldView } from '../sim/world';
import { ImpactAggregator } from './impactAggregator';
import { GLOBAL_VOICE_CAP, MIX } from './mixTable';
import type { MusicControl } from './musicControl';
import type { SoundBackend, SoundVoice } from './soundBackend';
import { DEFAULT_SPATIAL, spatialize, type SpatialConfig } from './spatial';
import { VoiceLimiter } from './voiceLimiter';

/** One crackle per this many ms of GAU-8 impacts. */
export const GUN_IMPACT_INTERVAL_MS = 100;

/** Player speed range used to pitch the engine (Low cruise → High cruise, world units/s). */
const ENGINE_SPEED_MIN = 150;
const ENGINE_SPEED_MAX = 360;
/** SAM lock build-up time; the RWR beep accelerates over it. */
const RWR_LOCK_BUILD_MS = 2000;

const EXPLOSION_BY_SIZE: Record<ExplosionSize, AudioKey> = {
  small: 'explosionSmall',
  medium: 'explosionMedium',
  large: 'explosionLarge',
  huge: 'explosionHuge',
};

export interface AudioDirectorDeps {
  backend: SoundBackend;
  /** Music to duck under radio calls/big blasts and to play the end sting on; null to skip. */
  music: MusicControl | null;
  /** Uniform [0, 1) source for pitch variation (injectable for tests). */
  random?: () => number;
  spatial?: SpatialConfig;
}

interface PlayOptions {
  /** Extra gain on top of the mix table. */
  volume?: number;
  /** Never attenuate below this gain (for sounds the player must hear, e.g. SAM launches). */
  minGain?: number;
  rate?: number;
}

/** Continuous sounds owned by the director. */
type LoopSlot = 'gun' | 'engine' | 'rwrLaunch' | 'rearm' | 'ambience';

const LOOP_KEYS: Record<LoopSlot, AudioKey> = {
  gun: 'gunLoop',
  engine: 'engineLoop',
  rwrLaunch: 'rwrLaunch',
  rearm: 'rearmLoop',
  ambience: 'battleAmbience',
};

/**
 * Engine-independent audio direction: turns simulation events and world state into sounds.
 * `AudioDirector` wraps this with the Phaser backend.
 */
export class AudioDirectorCore {
  private readonly backend: SoundBackend;
  private readonly music: MusicControl | null;
  private readonly random: () => number;
  private readonly spatial: SpatialConfig;
  private readonly limiter: VoiceLimiter<SoundVoice>;
  private readonly impacts = new ImpactAggregator(GUN_IMPACT_INTERVAL_MS);
  private readonly loops: Partial<Record<LoopSlot, SoundVoice>> = {};
  private readonly lastPlayedMs = new Map<AudioKey, number>();
  private whistles: SoundVoice[] = [];

  private nowMs = 0;
  private listener: Vec2 | null = null;
  private listenerAlt = 0;
  private gunFiring = false;
  private engineVolume = 0;
  private engineRate = 1;
  private rwrHeldMs = 0;
  private rwrNextBeepMs = 0;
  private lowHealthNextMs = 0;
  private radioOutAtMs: number | null = null;
  private ended = false;
  private destroyed = false;

  constructor(deps: AudioDirectorDeps) {
    this.backend = deps.backend;
    this.music = deps.music;
    this.random = deps.random ?? Math.random;
    this.spatial = deps.spatial ?? DEFAULT_SPATIAL;
    this.limiter = new VoiceLimiter<SoundVoice>((v) => v.playing, GLOBAL_VOICE_CAP);
  }

  handleEvents(events: readonly SimEvent[]): void {
    if (this.destroyed) return;
    for (const ev of events) this.handle(ev);
    this.flushImpacts();
  }

  update(dtMs: number, world: WorldView): void {
    if (this.destroyed) return;
    this.nowMs += dtMs;
    const p = world.player;
    this.listener = { x: p.pos.x, y: p.pos.y };
    this.listenerAlt = p.alt;
    if (world.ended && !this.ended) this.endMission(null);
    if (this.ended) {
      this.flushImpacts();
      return;
    }

    this.updateEngine(dtMs, p.alive, p.speed, p.energy);

    // Gun safety net: never leave the BRRRT running if a stop event was missed.
    if (this.gunFiring && (!p.firing || !p.alive)) this.stopGun(p.alive);

    // Missile launch warning outranks the lock beeps.
    const launch = p.alive && p.missilesTracking > 0;
    this.setLoop('rwrLaunch', launch, MIX.rwrLaunch.volume);
    if (p.alive && p.radarLocks > 0 && !launch) {
      this.rwrHeldMs += dtMs;
      if (this.nowMs >= this.rwrNextBeepMs) {
        this.playUi('rwrLock');
        const progress = Math.min(1, this.rwrHeldMs / RWR_LOCK_BUILD_MS);
        this.rwrNextBeepMs = this.nowMs + 430 - 320 * progress;
      }
    } else {
      this.rwrHeldMs = 0;
    }

    this.setLoop('rearm', p.alive && p.rearm > 0 && p.rearm < 1, MIX.rearmLoop.volume);

    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    if (p.alive && hpFrac <= 0.3) {
      if (this.nowMs >= this.lowHealthNextMs) {
        this.playUi('lowHealth');
        this.lowHealthNextMs = this.nowMs + (hpFrac <= 0.15 ? 650 : 1100);
      }
    } else {
      this.lowHealthNextMs = this.nowMs;
    }

    // Distant battle: more present down low, fainter from altitude.
    const altFrac = Math.max(0, Math.min(1, p.alt / 2));
    this.setLoop('ambience', true, MIX.battleAmbience.volume * (1 - 0.6 * altFrac));

    if (this.radioOutAtMs !== null && this.nowMs >= this.radioOutAtMs) {
      this.radioOutAtMs = null;
      this.playUi('radioOut');
    }
    this.flushImpacts();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const slot of Object.keys(this.loops) as LoopSlot[]) this.stopLoop(slot);
    for (const v of this.limiter.all()) v.stop();
    this.limiter.clear();
    this.whistles = [];
  }

  // ---------------------------------------------------------------------------

  private handle(ev: SimEvent): void {
    switch (ev.type) {
      case 'gunStarted':
        this.startGun();
        break;
      case 'gunStopped':
        this.stopGun(true);
        break;
      case 'gunImpact':
        this.impacts.add(ev.pos, ev.hit, ev.armored);
        break;
      case 'rocketLaunched':
        this.playAt('rocketLaunch', ev.pos);
        break;
      case 'missileLaunched':
        this.playAt('missileLaunch', ev.pos);
        break;
      case 'bombReleased': {
        this.playAt('bombRelease', ev.pos);
        const whistle = this.playAt('bombWhistle', ev.pos);
        if (whistle) this.whistles.push(whistle);
        break;
      }
      case 'ordnanceImpact':
        this.onOrdnanceImpact(ev.weapon, ev.pos);
        break;
      case 'flareDeployed':
        this.playAt('flare', ev.pos);
        break;
      case 'weaponSelected':
        this.playUi('weaponSwitch');
        break;
      case 'weaponUnavailable':
        this.playUi('dryFire');
        break;
      case 'lockAcquired':
        this.playUi('lockTone');
        break;
      case 'entityDestroyed':
        this.explode(ev.size, ev.pos);
        break;
      case 'secondaryExplosion':
        this.explode(ev.size, ev.pos);
        break;
      case 'groundFire':
        if (ev.shooterKind === 'tank' || ev.shooterKind === 'friendlyTank') this.playAt('tankFire', ev.from);
        else this.playAt('smallArms', ev.from);
        break;
      case 'aaBurst':
        this.playAt('aaFire', ev.pos);
        break;
      case 'samLockStarted':
        this.rwrNextBeepMs = this.nowMs; // first beep on the next update
        break;
      case 'samLaunched':
        this.playAt('samLaunch', ev.pos, { minGain: 0.35 });
        break;
      case 'samDetonated':
        this.playAt('explosionMedium', ev.pos, { volume: 0.9 });
        break;
      case 'playerHit':
        this.playUi('playerHit', { volume: Math.min(1, 0.65 + ev.damage / 40) });
        break;
      case 'playerDestroyed':
        this.stopGun(false);
        this.stopLoop('rwrLaunch');
        this.stopLoop('rearm');
        this.playUi('playerExplode');
        this.music?.duck(0.35, 1800);
        break;
      case 'rearmCompleted':
        this.stopLoop('rearm');
        this.playUi('rearmComplete');
        break;
      case 'rearmCancelled':
        this.stopLoop('rearm');
        break;
      case 'objectiveUpdated':
        if (ev.status === 'completed') this.playUi('objectiveComplete');
        else if (ev.status === 'failed') this.playUi('objectiveFailed');
        if (ev.status !== 'active') this.music?.duck(0.55, 1500);
        break;
      case 'radio': {
        this.playUi('radioIn');
        const holdMs = Math.max(1500, Math.min(4500, 700 + ev.text.length * 45));
        this.radioOutAtMs = this.nowMs + holdMs;
        this.music?.duck(0.45, holdMs);
        break;
      }
      case 'missionEnded':
        this.endMission(ev.outcome);
        break;
      default:
        // gunFiring, entityDamaged, spotting, band changes, rearmStarted (loop follows world state),
        // SAM decoy/lost-lock and score events are visual/HUD-only.
        break;
    }
  }

  /** Silence the cockpit and ambience; play the end sting when the outcome is known. */
  private endMission(outcome: MissionOutcome | null): void {
    if (!this.ended) {
      this.ended = true;
      this.stopGun(false);
      for (const slot of Object.keys(this.loops) as LoopSlot[]) this.stopLoop(slot);
    }
    if (outcome) this.music?.playSting(outcome);
  }

  private onOrdnanceImpact(weapon: 'rocket' | 'maverick' | 'bomb' | 'tankShell', pos: Vec2): void {
    switch (weapon) {
      case 'rocket':
        this.playAt('explosionSmall', pos);
        break;
      case 'maverick':
        this.playAt('explosionMedium', pos);
        break;
      case 'bomb':
        this.whistles.shift()?.stop();
        this.playAt('explosionLarge', pos);
        this.music?.duck(0.5, 900);
        break;
      case 'tankShell':
        this.playAt('explosionSmall', pos, { volume: 0.55 });
        break;
    }
  }

  private explode(size: ExplosionSize, pos: Vec2): void {
    this.playAt(EXPLOSION_BY_SIZE[size], pos);
    if (size === 'large' || size === 'huge') this.music?.duck(size === 'huge' ? 0.35 : 0.5, size === 'huge' ? 2000 : 900);
  }

  private startGun(): void {
    this.gunFiring = true;
    const rate = 1 + (this.random() * 2 - 1) * 0.015;
    const gun = this.ensureLoop('gun', MIX.gunLoop.volume);
    gun.setRate(rate);
  }

  private stopGun(withTail: boolean): void {
    if (!this.gunFiring) return;
    this.gunFiring = false;
    this.stopLoop('gun');
    if (withTail) this.playUi('gunTail');
  }

  private updateEngine(dtMs: number, alive: boolean, speed: number, energy: number): void {
    const speedN = Math.max(0, Math.min(1, (speed - ENGINE_SPEED_MIN) / (ENGINE_SPEED_MAX - ENGINE_SPEED_MIN)));
    const targetRate = (0.86 + 0.32 * speedN) * (1 + (energy - 1) * 0.6);
    const targetVolume = alive ? MIX.engineLoop.volume * (0.75 + 0.25 * speedN) : 0;
    this.engineVolume += (targetVolume - this.engineVolume) * (1 - Math.exp(-dtMs / (alive ? 250 : 120)));
    this.engineRate += (targetRate - this.engineRate) * (1 - Math.exp(-dtMs / 300));
    if (!alive && this.engineVolume < 0.01) {
      this.stopLoop('engine');
      return;
    }
    const engine = this.ensureLoop('engine', this.engineVolume);
    engine.setVolume(this.engineVolume);
    engine.setRate(this.engineRate);
  }

  private ensureLoop(slot: LoopSlot, volume: number): SoundVoice {
    let voice = this.loops[slot];
    if (!voice) {
      voice = this.backend.create(LOOP_KEYS[slot], { volume, loop: true });
      voice.play();
      this.loops[slot] = voice;
    }
    return voice;
  }

  private setLoop(slot: LoopSlot, on: boolean, volume: number): void {
    if (on) this.ensureLoop(slot, volume).setVolume(volume);
    else this.stopLoop(slot);
  }

  private stopLoop(slot: LoopSlot): void {
    const voice = this.loops[slot];
    if (!voice) return;
    voice.stop();
    voice.destroy();
    delete this.loops[slot];
  }

  private flushImpacts(): void {
    const burst = this.impacts.flush(this.nowMs);
    if (burst) this.playAt('gunImpacts', burst.pos, { volume: 0.55 + 0.45 * Math.min(1, burst.count / 6) });
  }

  /** Non-positional sound (cockpit, UI, the player's own aircraft). */
  private playUi(key: AudioKey, opts: PlayOptions = {}): SoundVoice | null {
    return this.start(key, 1, 0, opts);
  }

  /** Positional sound: attenuated by distance (and altitude) from the player, panned by relative x. */
  private playAt(key: AudioKey, pos: Vec2, opts: PlayOptions = {}): SoundVoice | null {
    if (!this.listener) return this.start(key, 1, 0, opts);
    const s = spatialize(this.listener, this.listenerAlt, pos, this.spatial);
    return this.start(key, Math.max(s.gain, opts.minGain ?? 0), s.pan, opts);
  }

  private start(key: AudioKey, gain: number, pan: number, opts: PlayOptions): SoundVoice | null {
    // While the browser still blocks audio, one-shots would all fire at once on unlock: skip them.
    if (this.backend.locked) return null;
    const mix = MIX[key];
    const volume = mix.volume * (opts.volume ?? 1) * gain;
    if (volume < 0.015) return null;
    const last = this.lastPlayedMs.get(key);
    if (mix.minIntervalMs !== undefined && last !== undefined && this.nowMs - last < mix.minIntervalMs) return null;
    const req = this.limiter.request(key, { max: mix.cap ?? 4, policy: mix.policy ?? 'drop' });
    if (!req.allow) return null;
    req.evict?.stop();
    const vary = mix.vary ?? 0;
    const rate = opts.rate ?? 1 + (this.random() * 2 - 1) * vary;
    const voice = this.backend.play(key, { volume, rate, pan });
    if (voice) {
      this.limiter.register(key, voice);
      this.lastPlayedMs.set(key, this.nowMs);
    }
    return voice;
  }
}
