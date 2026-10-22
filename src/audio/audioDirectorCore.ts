import type { AudioKey } from '../assets';
import type { Entity } from '../sim/entities';
import type { SimEvent } from '../sim/events';
import type { Vec2 } from '../sim/math';
import type { ExplosionSize, MissionOutcome, PlayerDamageSource } from '../sim/types';
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
/** Armour fractions for the low-armour warning: one alert on going critical, one more when nearly dead. */
const LOW_ARMOR_CRITICAL = 0.3;
const LOW_ARMOR_SEVERE = 0.15;
/** While an AA beam sits on the aircraft, its hit sounds repeat at most this often. */
const BEAM_SHIELD_HIT_INTERVAL_MS = 150;
const BEAM_HULL_HIT_INTERVAL_MS = 200;
/** Kill-chain blip: up this many semitones per chain step, capped at an octave. */
const COMBO_SEMITONES_PER_STEP = 2;
const COMBO_MAX_SEMITONES = 12;
/** A beam is a little louder while it is on the aircraft. */
const BEAM_ON_TARGET_GAIN = 1.25;
/** Boost roar fade-out after release (ms time constant). */
const BOOST_RELEASE_MS = 90;
/** A helicopter's rotor loop starts once it is audible (spatial gain) and stops when it falls silent. */
const ROTOR_START_GAIN = 0.02;

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
type LoopSlot = 'gun' | 'engine' | 'rwrLaunch' | 'rearm' | 'ambience' | 'boost';

const LOOP_KEYS: Record<LoopSlot, AudioKey> = {
  boost: 'boostLoop',
  gun: 'gunLoop',
  engine: 'engineLoop',
  rwrLaunch: 'rwrLaunch',
  rearm: 'rearmLoop',
  ambience: 'battleAmbience',
};

/** One AA gun's beam hum: a spatialised loop at the (static) gun position. */
interface BeamVoice {
  voice: SoundVoice;
  pos: Vec2;
}

/** Playback rate of the kill-chain blip for a chain (the sim reports chains from 2 up). */
function comboRate(chain: number): number {
  const semitones = Math.min(COMBO_MAX_SEMITONES, Math.max(0, chain - 2) * COMBO_SEMITONES_PER_STEP);
  return Math.pow(2, semitones / 12);
}

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
  /** AA telegraph charge sounds and beam loops, by gun entity id. */
  private readonly charges = new Map<number, SoundVoice>();
  private readonly beams = new Map<number, BeamVoice>();
  /** Rotor loops of spotted helicopters, by entity id (re-spatialised every update: they move). */
  private readonly rotors = new Map<number, SoundVoice>();
  /** Director-level throttles (tag → last time played). */
  private readonly lastThrottleMs = new Map<string, number>();

  private nowMs = 0;
  private listener: Vec2 | null = null;
  private listenerAlt = 0;
  private gunFiring = false;
  private boosting = false;
  private boostVolume = 0;
  private engineVolume = 0;
  private engineRate = 1;
  private rwrHeldMs = 0;
  private rwrNextBeepMs = 0;
  /** Low-armour warnings already sounded: 0 none, 1 critical, 2 severe. */
  private lowHealthStage = 0;
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
    // Same for the afterburner, which also fades out after release.
    if (this.boosting && (!p.boosting || !p.alive)) this.boosting = false;
    this.updateBoost(dtMs);
    this.updateAirDefence(world);
    this.updateRotors(world);

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

    // Low armour: alert once on going critical and once more when nearly dead, never a continuous
    // beep (the HUD keeps showing ARMOR CRITICAL). Re-arms after a repair or a respawn.
    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const stage = !p.alive ? 0 : hpFrac <= LOW_ARMOR_SEVERE ? 2 : hpFrac <= LOW_ARMOR_CRITICAL ? 1 : 0;
    if (stage > this.lowHealthStage) this.playUi('lowHealth');
    this.lowHealthStage = stage;

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
    this.boosting = false;
    this.stopAirDefence();
    this.stopRotors();
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
        this.stopCharge(ev.entityId);
        this.stopBeam(ev.entityId);
        this.stopRotor(ev.entityId);
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
        // Legacy bullet bursts (AA guns now fire lasers); harmless if still emitted.
        this.playAt('aaFire', ev.pos);
        break;
      case 'aaAiming':
        this.startCharge(ev.entityId, ev.pos);
        break;
      case 'aaBeamStarted':
        this.stopCharge(ev.entityId);
        this.startBeam(ev.entityId, ev.pos);
        break;
      case 'aaBeamStopped':
        this.stopBeam(ev.entityId);
        break;
      case 'heliRocketsFired':
        this.playAt('rocketLaunch', ev.pos);
        break;
      case 'heliRocketExploded':
        this.playAt('explosionSmall', ev.pos, { volume: ev.hitPlayer ? 1 : 0.75 });
        break;
      case 'mlrsLaunched':
        // The ripple launch is the "incoming" cue: always audible when it's aimed at you.
        this.playAt('mlrsLaunch', ev.pos, ev.atPlayer ? { minGain: 0.4 } : {});
        break;
      case 'mlrsImpact':
        this.playAt('explosionSmall', ev.pos, { volume: ev.hitPlayer ? 1 : 0.8 });
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
      case 'samEvaded':
        this.playAt('samEvaded', ev.pos, { minGain: 0.6 });
        break;
      case 'scoreAwarded':
        // A STRAFE ×N pass is a skill reward too: same sting as out-turning a SAM.
        if (ev.reason.startsWith('STRAFE') && ev.pos) this.playAt('samEvaded', ev.pos, { minGain: 0.6 });
        break;
      case 'playerHit':
        this.onPlayerHit(ev.damage, ev.source);
        break;
      case 'shieldHit':
        this.onShieldHit(ev.source);
        break;
      case 'shieldDown':
        this.playUi('shieldDown');
        break;
      case 'shieldRegenStarted':
        this.playUi('shieldRegen');
        break;
      case 'shieldFull':
        this.playUi('shieldFull');
        break;
      case 'boostStarted':
        this.startBoost();
        break;
      case 'boostStopped':
        this.boosting = false;
        break;
      case 'boostEmpty':
        this.boosting = false;
        this.playUi('boostEmpty');
        break;
      case 'brakeStarted':
        this.playUi('airbrake');
        break;
      case 'pickupSpawned':
        this.playAt('pickupSpawn', ev.pos);
        break;
      case 'pickupCollected':
        this.playUi('pickupCollect');
        break;
      case 'comboChanged':
        this.playUi('comboUp', { rate: comboRate(ev.chain) });
        break;
      case 'comboEnded':
        this.playUi('comboEnd');
        break;
      case 'zoneCleared':
        this.playUi('zoneCleared');
        this.music?.duck(0.55, 1200);
        break;
      case 'playerDestroyed':
        this.stopBoost();
        this.stopAirDefence();
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
        // SAM decoy/lost-lock, brakeStopped, pickupExpired and score events are visual/HUD-only.
        break;
    }
  }

  /** Silence the cockpit and ambience; play the end sting when the outcome is known. */
  private endMission(outcome: MissionOutcome | null): void {
    if (!this.ended) {
      this.ended = true;
      this.stopGun(false);
      this.boosting = false;
      this.stopAirDefence();
      this.stopRotors();
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

  private onPlayerHit(damage: number, source: PlayerDamageSource): void {
    // A beam deals damage every step: a quieter, rate-limited clank instead of a metallic hail.
    if (source === 'beam') {
      if (this.throttle('beamHull', BEAM_HULL_HIT_INTERVAL_MS)) this.playUi('playerHit', { volume: 0.5 });
      return;
    }
    this.playUi('playerHit', { volume: Math.min(1, 0.65 + damage / 40) });
  }

  private onShieldHit(source: PlayerDamageSource): void {
    if (source === 'beam') {
      if (this.throttle('beamShield', BEAM_SHIELD_HIT_INTERVAL_MS)) this.playUi('shieldHit', { volume: 0.75 });
      return;
    }
    this.playUi('shieldHit');
  }

  private startBoost(): void {
    this.boosting = true;
    this.boostVolume = MIX.boostLoop.volume;
    this.ensureLoop('boost', this.boostVolume).setVolume(this.boostVolume);
    this.playUi('boostStart');
  }

  /** Cut the afterburner at once (death, mission end). */
  private stopBoost(): void {
    this.boosting = false;
    this.boostVolume = 0;
    this.stopLoop('boost');
  }

  /** Fade the afterburner roar out after release. */
  private updateBoost(dtMs: number): void {
    const voice = this.loops.boost;
    if (!voice) return;
    const target = this.boosting ? MIX.boostLoop.volume : 0;
    this.boostVolume += (target - this.boostVolume) * (1 - Math.exp(-dtMs / BOOST_RELEASE_MS));
    if (!this.boosting && this.boostVolume < 0.01) {
      this.stopBoost();
      return;
    }
    voice.setVolume(this.boostVolume);
  }

  private startCharge(entityId: number, pos: Vec2): void {
    this.stopCharge(entityId);
    const voice = this.playAt('aaCharge', pos);
    if (voice) this.charges.set(entityId, voice);
  }

  private stopCharge(entityId: number): void {
    this.charges.get(entityId)?.stop();
    this.charges.delete(entityId);
  }

  private startBeam(entityId: number, pos: Vec2): void {
    this.stopBeam(entityId);
    const voice = this.backend.create('aaBeamLoop', { volume: 0, loop: true });
    voice.play();
    this.beams.set(entityId, { voice, pos: { x: pos.x, y: pos.y } });
    this.mixBeams(null);
  }

  private stopBeam(entityId: number): void {
    const beam = this.beams.get(entityId);
    if (!beam) return;
    beam.voice.stop();
    beam.voice.destroy();
    this.beams.delete(entityId);
  }

  private stopAirDefence(): void {
    for (const id of [...this.charges.keys()]) this.stopCharge(id);
    for (const id of [...this.beams.keys()]) this.stopBeam(id);
  }

  /**
   * Safety net + mix for AA sounds: drop charges/beams whose gun died or left that phase (an aim can
   * be abandoned without an event), and re-spatialise the beams as the aircraft moves.
   */
  private updateAirDefence(world: WorldView): void {
    if (this.charges.size === 0 && this.beams.size === 0) return;
    const byId = new Map(world.entities.map((e) => [e.id, e]));
    for (const [id, voice] of this.charges) {
      const gun = byId.get(id);
      if (!voice.playing) this.charges.delete(id);
      else if (gun && (!gun.alive || gun.aa?.phase !== 'aiming')) this.stopCharge(id);
    }
    for (const id of [...this.beams.keys()]) {
      const gun = byId.get(id);
      if (gun && (!gun.alive || gun.aa?.phase !== 'firing')) this.stopBeam(id);
    }
    this.mixBeams(byId);
  }

  /** Spatial level per beam; several at once share the level so overlapping beams don't pile up. */
  private mixBeams(byId: ReadonlyMap<number, Entity> | null): void {
    const share = 1 / Math.sqrt(Math.max(1, this.beams.size));
    for (const [id, beam] of this.beams) {
      const s = this.listener ? spatialize(this.listener, this.listenerAlt, beam.pos, this.spatial) : { gain: 1, pan: 0 };
      const onTarget = byId?.get(id)?.aa?.beamOnTarget ? BEAM_ON_TARGET_GAIN : 1;
      beam.voice.setVolume(Math.min(1, MIX.aaBeamLoop.volume * s.gain * onTarget * share));
      beam.voice.setPan(s.pan);
    }
  }

  /**
   * One spatial rotor loop per live, spotted helicopter while it is within earshot. Several at once
   * share the level so a pair doesn't double the drone.
   */
  private updateRotors(world: WorldView): void {
    const listener = this.listener;
    if (!listener) return;
    const audible = new Map<number, { gain: number; pan: number }>();
    for (const e of world.entities) {
      if (!e.heli || !e.alive || e.hidden || !e.spotted) continue;
      const s = spatialize(listener, this.listenerAlt, e.pos, this.spatial);
      if (s.gain >= ROTOR_START_GAIN || (this.rotors.has(e.id) && s.gain > 0)) audible.set(e.id, s);
    }
    for (const id of [...this.rotors.keys()]) if (!audible.has(id)) this.stopRotor(id);
    if (audible.size === 0) return;
    const share = 1 / Math.sqrt(audible.size);
    for (const [id, s] of audible) {
      let voice = this.rotors.get(id);
      if (!voice) {
        voice = this.backend.create('heliLoop', { volume: 0, loop: true });
        voice.play();
        this.rotors.set(id, voice);
      }
      voice.setVolume(Math.min(1, MIX.heliLoop.volume * s.gain * share));
      voice.setPan(s.pan);
    }
  }

  private stopRotor(entityId: number): void {
    const voice = this.rotors.get(entityId);
    if (!voice) return;
    voice.stop();
    voice.destroy();
    this.rotors.delete(entityId);
  }

  private stopRotors(): void {
    for (const id of [...this.rotors.keys()]) this.stopRotor(id);
  }

  /** True (and restarts the timer) if `tag` was last allowed at least `intervalMs` ago. */
  private throttle(tag: string, intervalMs: number): boolean {
    const last = this.lastThrottleMs.get(tag);
    if (last !== undefined && this.nowMs - last < intervalMs) return false;
    this.lastThrottleMs.set(tag, this.nowMs);
    return true;
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
