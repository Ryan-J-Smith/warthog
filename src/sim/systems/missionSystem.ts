import { PLAYER, SCORING } from '../../config';
import { distance } from '../math';
import { allPrimariesResolved } from '../triggers';
import type { MissionOutcome } from '../types';
import type { MissionResults, World } from '../world';
import { SimSystem, type StepContext } from './simSystem';

/** RTB once primaries are resolved; ends the mission on landing, timeout, or game over. */
export class MissionSystem extends SimSystem {
  update({ world }: StepContext): void {
    if (world.ended) return;
    const p = world.player;

    if (world.level.endOnResolve && allPrimariesResolved(world)) {
      const anyPrimaryFailed = world.objectives.some((o) => o.primary && o.status === 'failed');
      endMission(world, anyPrimaryFailed ? 'defeat' : 'victory');
      return;
    }

    if (!world.rtb && allPrimariesResolved(world)) {
      world.rtb = true;
      world.rtbAt = world.time;
    }

    if (!p.alive && p.lives <= 0 && p.respawnIn <= 0) {
      endMission(world, 'defeat');
      return;
    }

    if (world.rtb) {
      const home = p.alive && p.band === 'low' && distance(p.pos, world.homeBasePos()) <= PLAYER.rearmRadius;
      const timedOut = world.rtbAt !== null && world.time - world.rtbAt >= SCORING.rtbGrace;
      if (home || timedOut) {
        const anyPrimaryWon = world.objectives.some((o) => o.primary && o.status === 'completed');
        endMission(world, anyPrimaryWon ? 'victory' : 'defeat');
      }
    }
  }
}

export function endMission(world: World, outcome: MissionOutcome): void {
  world.ended = true;
  world.results = computeResults(world, outcome);
  world.emit({ type: 'missionEnded', outcome });
}

export function computeResults(world: World, outcome: MissionOutcome): MissionResults {
  const objectives = world.level.objectives.map((def) => {
    const state = world.objectives.find((o) => o.id === def.id);
    const status = state?.status ?? 'active';
    const points = status === 'completed' ? (def.primary ? SCORING.primaryObjective : SCORING.optionalObjective) : 0;
    return { id: def.id, title: def.title, primary: def.primary, status, points };
  });
  const won = outcome === 'victory';
  const timeBonus = won ? Math.max(0, Math.round((world.level.parTime - world.time) * SCORING.timeBonusPerSecondUnderPar)) : 0;
  const livesBonus = won ? Math.max(0, world.player.lives) * SCORING.lifeBonus : 0;
  const total = Math.round(world.score + timeBonus + livesBonus);
  const scale = world.level.gradeScale ?? 1;
  const grade = SCORING.grades.find((g) => total >= g.min * scale)?.grade ?? 'D';
  return {
    outcome,
    time: world.time,
    killPoints: world.stats.killPoints,
    kills: world.stats.kills,
    bonusPoints: world.stats.bonusPoints,
    feats: {
      bestChain: world.stats.bestChain,
      missilesDefeated: world.stats.missilesDefeated,
      zonesCleared: world.stats.zonesCleared,
      pickupsCollected: world.stats.pickupsCollected,
      killsByKind: { ...world.stats.killsByKind },
      hullDamage: Math.round(world.stats.hullDamage),
      deaths: world.stats.deaths,
      escapes: world.escapes,
    },
    objectives,
    objectivePoints: objectives.reduce((sum, o) => sum + o.points, 0),
    timeBonus,
    livesBonus,
    friendlyFirePenalty: Math.round(world.stats.friendlyFirePenalty),
    total,
    grade,
  };
}
