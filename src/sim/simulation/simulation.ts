import type { SimEvent } from '../events';
import type { ControlInput } from '../input';
import type { LevelDefinition } from '../level';
import type { PlayerLoadout } from '../loadout';
import { spawnFromDefinition } from '../spawning';
import {
  AirDefenseSystem,
  ConvoySystem,
  FlightSystem,
  GroundUnitSystem,
  HelicopterSystem,
  LaneSystem,
  MissionSystem,
  ObjectiveSystem,
  PendingFireSystem,
  PlayerLifeSystem,
  ProjectileSystem,
  RadioSystem,
  RearmSystem,
  RewardSystem,
  SimSystem,
  SpawnSystem,
  SpottingSystem,
  WaveSystem,
  WeaponSystem,
  initObjectives,
  initZones,
} from '../systems';
import { World, type WorldView } from '../world';

/** Fixed simulation step (60 Hz). */
export const SIM_STEP = 1 / 60;
/** Longest real-time slice processed per `advance` call (avoids the spiral of death). */
const MAX_FRAME = 0.1;

/**
 * Owns the world and runs the systems in a fixed order at a fixed timestep.
 * Pure TypeScript: no rendering, no input devices, deterministic for a given seed.
 */
export class Simulation {
  readonly world: World;
  private readonly systems: SimSystem[];
  private accumulator = 0;
  /** Edge-triggered inputs buffered until a fixed step consumes them. */
  private pendingEdges: Omit<ControlInput, 'turn' | 'fire' | 'boost' | 'brake'> = { climb: false, dive: false, flare: false, select: null };

  constructor(level: LevelDefinition, seed?: number, systems?: SimSystem[], loadout?: Readonly<PlayerLoadout>) {
    this.world = new World(level, seed, loadout);
    for (const spawn of level.entities) spawnFromDefinition(this.world, spawn);
    initObjectives(this.world);
    initZones(this.world);
    this.systems = systems ?? Simulation.defaultSystems();
  }

  static defaultSystems(): SimSystem[] {
    return [
      new SpawnSystem(),
      new ConvoySystem(),
      new WaveSystem(),
      new PlayerLifeSystem(),
      new FlightSystem(),
      new RearmSystem(),
      new WeaponSystem(),
      new GroundUnitSystem(),
      new AirDefenseSystem(),
      new HelicopterSystem(),
      new ProjectileSystem(),
      new PendingFireSystem(),
      new RewardSystem(),
      new SpottingSystem(),
      new ObjectiveSystem(),
      new LaneSystem(),
      new RadioSystem(),
      new MissionSystem(),
    ];
  }

  get view(): WorldView {
    return this.world;
  }

  /**
   * Advance by `dtSeconds` of real time, running as many fixed steps as fit.
   * Returns every event produced.
   */
  advance(dtSeconds: number, input: ControlInput): SimEvent[] {
    this.bufferEdges(input);
    this.accumulator += Math.min(dtSeconds, MAX_FRAME);
    while (this.accumulator >= SIM_STEP) {
      this.accumulator -= SIM_STEP;
      this.stepOnce(input);
    }
    return this.world.drainEvents();
  }

  /** Run exactly one fixed step (tests). Events stay queued until `drainEvents`. */
  step(input: ControlInput): void {
    this.bufferEdges(input);
    this.stepOnce(input);
  }

  drainEvents(): SimEvent[] {
    return this.world.drainEvents();
  }

  private bufferEdges(input: ControlInput): void {
    const e = this.pendingEdges;
    e.climb ||= input.climb;
    e.dive ||= input.dive;
    e.flare ||= input.flare;
    e.select = input.select ?? e.select;
  }

  private stepOnce(input: ControlInput): void {
    if (this.world.ended) return;
    const stepInput: ControlInput = { turn: input.turn, fire: input.fire, boost: input.boost, brake: input.brake, ...this.pendingEdges };
    this.pendingEdges = { climb: false, dive: false, flare: false, select: null };
    this.world.time += SIM_STEP;
    const ctx = { world: this.world, dt: SIM_STEP, input: stepInput };
    for (const system of this.systems) system.update(ctx);
  }
}
