import type { LaneDefinition } from '../level';
import { distance } from '../math';
import type { RadioTone } from '../types';
import type { World } from '../world';
import { ENEMY_WAVE_TAG, laneBroken, laneControl, laneLead, laneUnits } from './laneFront';
import { endMission } from './missionSystem';
import { SimSystem, type StepContext } from './simSystem';

/** Lane meter below which the road is "collapsing" (enemy armour 70 % of the way to our HQ). */
const COLLAPSE_AT = 0.3;
/** …and above which the warning re-arms. */
const RECOVERED_AT = 0.55;
/** Friendly units this deep down a road are at the enemy HQ. */
const SIEGE_AT = 0.85;
/** Friendly HQ integrity call-outs. */
const HQ_WARNINGS = [0.75, 0.5, 0.25] as const;
/** Enemies within this distance of any friendly ground unit or structure are reported (spotted). */
const FRIENDLY_SPOT_RADIUS = 650;
const SPOT_INTERVAL = 0.5;

/**
 * Lane war rules that aren't spawning: shows each road's front on its objective, announces
 * consequences (depot down, road collapsing, our armour at their HQ, HQ integrity), lets friendly
 * forces report contacts, ends the mission when our HQ falls, and routs the enemy when theirs does.
 */
export class LaneSystem extends SimSystem {
  private readonly collapsing = new Set<string>();
  private readonly announcedBroken = new Set<string>();
  private readonly sieging = new Set<string>();
  private hqWarnings = 0;
  private routed = false;
  private nextSpot = 0;

  update({ world }: StepContext): void {
    const war = world.level.laneWar;
    if (!war || world.ended) return;

    const friendlyHq = world.findByRef(war.friendlyHqRefId);
    if (friendlyHq && !friendlyHq.alive) {
      endMission(world, 'defeat');
      return;
    }
    const enemyHq = world.findByRef(war.enemyHqRefId);
    if (enemyHq && !enemyHq.alive && !this.routed) {
      this.routed = true;
      rout(world);
    }

    for (const lane of war.lanes) this.updateLane(world, lane);
    if (friendlyHq) this.hqCallouts(world, friendlyHq.hp / friendlyHq.maxHp);
    if (world.time >= this.nextSpot) {
      this.nextSpot = world.time + SPOT_INTERVAL;
      friendlySpotting(world);
    }
  }

  private updateLane(world: World, lane: LaneDefinition): void {
    const control = laneControl(world, lane);
    const hostiles = laneUnits(world, lane.id, 'enemy').length;
    const state = lane.objectiveId ? world.objectives.find((o) => o.id === lane.objectiveId) : undefined;
    if (state && state.status === 'active') {
      state.meter = control;
      const front = control < COLLAPSE_AT ? 'collapsing' : `${Math.round(control * 100)}%`;
      state.detail = `Road ${front} · ${hostiles} hostile${hostiles === 1 ? '' : 's'}`;
    }
    if (this.routed) return;

    if (!this.collapsing.has(lane.id) && control < COLLAPSE_AT) {
      this.collapsing.add(lane.id);
      radio(world, 'HQ', 'urgent', `${lane.name} is collapsing! Enemy armour is closing on HQ!`);
    } else if (this.collapsing.has(lane.id) && control > RECOVERED_AT) {
      this.collapsing.delete(lane.id);
      radio(world, 'HQ', 'good', `${lane.name} is holding again. Good work, Warthog.`);
    }

    if (!this.announcedBroken.has(lane.id) && laneBroken(world, lane)) {
      this.announcedBroken.add(lane.id);
      radio(world, 'OVERLORD', 'good', `${lane.name} depot is burning! Their waves there are thinned out, and our armour gets reinforcements.`);
    }

    const siege = laneLead(world, lane.id, 'friendly') >= SIEGE_AT;
    if (siege && !this.sieging.has(lane.id)) {
      this.sieging.add(lane.id);
      radio(world, 'ARMOR', 'good', `Friendly armour at the enemy HQ from the ${lane.name}! We're shelling the compound!`);
    } else if (!siege) {
      this.sieging.delete(lane.id);
    }
  }

  private hqCallouts(world: World, integrity: number): void {
    const next = HQ_WARNINGS[this.hqWarnings];
    if (next === undefined || integrity > next) return;
    this.hqWarnings += 1;
    const pct = Math.round(next * 100);
    radio(world, 'HQ', integrity <= 0.25 ? 'bad' : 'urgent', `HQ integrity ${pct} percent! Clear the roads, Warthog!`);
  }
}

/** Their HQ is gone: every enemy wave unit breaks off and runs for home (still fair game). */
function rout(world: World): void {
  for (const unit of world.entities) {
    if (!unit.alive || !unit.tags.includes(ENEMY_WAVE_TAG)) continue;
    unit.tags = unit.tags.filter((t) => t !== ENEMY_WAVE_TAG);
    unit.attacker = null;
    const mover = unit.mover;
    if (!mover) continue;
    const back = mover.path.slice(0, Math.max(1, mover.waypoint)).reverse();
    mover.path = back.length > 0 ? back : [{ ...unit.pos }];
    mover.waypoint = 0;
    mover.halted = false;
    mover.stopAtWaypoint = null;
  }
  radio(world, 'OVERLORD', 'good', 'Their armour is breaking and running for home! Hunt them down if you like.');
}

/** Friendly ground forces report enemies near them, so the minimap shows every road's fight. */
function friendlySpotting(world: World): void {
  const eyes = world.entities.filter((e) => e.alive && e.team === 'friendly' && e.kind !== 'homeBase');
  for (const e of world.entities) {
    if (!e.alive || e.hidden || e.spotted || e.team !== 'enemy') continue;
    if (eyes.some((f) => distance(f.pos, e.pos) <= FRIENDLY_SPOT_RADIUS)) {
      e.spotted = true;
      world.emit({ type: 'entitySpotted', entityId: e.id, kind: e.kind });
    }
  }
}

function radio(world: World, speaker: string, tone: RadioTone, text: string): void {
  world.emit({ type: 'radio', speaker, tone, text });
}

