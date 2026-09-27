import type { MissionResults } from '../../sim/world';
import { formatClock, formatScore } from './numbers';

/**
 * One-line shareable result, e.g. `WARTHOG · River Crossing · Grade A · 23,450 pts · 6:12`.
 * A failed mission says so, so a D on a victory can't be mistaken for a defeat.
 */
export function shareLine(levelName: string, results: MissionResults): string {
  const parts = ['WARTHOG', levelName];
  if (results.outcome === 'defeat') parts.push('Mission failed');
  parts.push(`Grade ${results.grade}`, `${formatScore(results.total)} pts`, formatClock(results.time));
  return parts.join(' · ');
}
