import type { RunRecord } from './runner';

/** Seconds → m:ss. */
export function clock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(n: number, of: number): string {
  return of === 0 ? '—' : `${Math.round((100 * n) / of)}%`;
}

function fixed(n: number, digits = 0): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

function saved(r: RunRecord, id: string): boolean {
  return r.objectives[id]?.status === 'completed';
}

function resolvedTimes(runs: readonly RunRecord[], id: string): string {
  const times = runs.filter((r) => saved(r, id)).map((r) => r.objectives[id]?.time ?? NaN);
  return times.length === 0 ? '—' : clock(mean(times));
}

/** Group runs by `bot` + `skill`, preserving first-seen order. */
export function groupRuns(runs: readonly RunRecord[]): Map<string, RunRecord[]> {
  const groups = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const key = `${r.bot} (${r.skill})`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return groups;
}

function gradeSpread(runs: readonly RunRecord[]): string {
  const counts = new Map<string, number>();
  for (const r of runs) counts.set(r.grade, (counts.get(r.grade) ?? 0) + 1);
  return ['S', 'A', 'B', 'C', 'D']
    .filter((g) => counts.has(g))
    .map((g) => `${g}×${counts.get(g)}`)
    .join(' ');
}

/** Headline outcomes per strategy. */
export function outcomeTable(runs: readonly RunRecord[]): string {
  const rows: string[][] = [];
  for (const [key, group] of groupRuns(runs)) {
    const n = group.length;
    const both = group.filter((r) => saved(r, 'column') && saved(r, 'outpost')).length;
    rows.push([
      key,
      String(n),
      pct(both, n),
      `${pct(group.filter((r) => saved(r, 'column')).length, n)} @${resolvedTimes(group, 'column')}`,
      `${pct(group.filter((r) => saved(r, 'outpost')).length, n)} @${resolvedTimes(group, 'outpost')}`,
      `${pct(group.filter((r) => saved(r, 'sam')).length, n)}`,
      `${pct(group.filter((r) => saved(r, 'dump')).length, n)}`,
      fixed(mean(group.map((r) => r.deaths)), 1),
      fixed(mean(group.map((r) => r.score))),
      gradeSpread(group),
      clock(mean(group.map((r) => r.endTime))),
    ]);
  }
  return table(
    ['bot (skill)', 'n', 'both primaries', 'bridge/column ✓ @t', 'Bravo ✓ @t', 'SAM', 'dump', 'deaths', 'score', 'grades', 'end'],
    rows,
  );
}

/** Damage, ammo and altitude usage per strategy. */
export function detailTable(runs: readonly RunRecord[]): string {
  const rows: string[][] = [];
  for (const [key, group] of groupRuns(runs)) {
    const band = (b: 'low' | 'medium' | 'high'): number =>
      mean(group.map((r) => r.bandTime[b] / Math.max(1, r.bandTime.low + r.bandTime.medium + r.bandTime.high)));
    rows.push([
      key,
      fixed(mean(group.map((r) => r.damage.aa))),
      fixed(mean(group.map((r) => r.damage.sam))),
      `${fixed(mean(group.map((r) => r.sam.launched)), 1)}/${fixed(mean(group.map((r) => r.sam.hitPlayer)), 1)}`,
      fixed(mean(group.map((r) => r.ammoSpent.gun))),
      fixed(mean(group.map((r) => r.ammoSpent.rockets)), 1),
      fixed(mean(group.map((r) => r.ammoSpent.maverick)), 1),
      fixed(mean(group.map((r) => r.ammoSpent.bombs)), 1),
      fixed(mean(group.map((r) => r.flaresSpent)), 1),
      fixed(mean(group.map((r) => r.rearms)), 1),
      `${fixed(100 * band('low'))}/${fixed(100 * band('medium'))}/${fixed(100 * band('high'))}`,
      fixed(mean(group.map((r) => r.bridgeDropKills)), 1),
      `${fixed(100 * mean(group.map((r) => r.outpostEnd)))}%`,
    ]);
  }
  return table(
    ['bot (skill)', 'AA dmg', 'SAM dmg', 'SAM launch/hit', 'gun rds', 'rkt salvos', 'mav', 'bombs', 'flares', 'rearms', 'L/M/H %', 'span kills', 'Bravo HP'],
    rows,
  );
}

/** Score breakdown per strategy (from the results screen). */
export function scoreTable(runs: readonly RunRecord[]): string {
  const rows: string[][] = [];
  for (const [key, group] of groupRuns(runs)) {
    const res = group.map((r) => r.results).filter((x): x is NonNullable<typeof x> => x !== null);
    rows.push([
      key,
      fixed(mean(res.map((x) => x.killPoints))),
      fixed(mean(res.map((x) => x.objectivePoints))),
      fixed(mean(res.map((x) => x.timeBonus))),
      fixed(mean(res.map((x) => x.livesBonus))),
      fixed(mean(res.map((x) => x.friendlyFirePenalty))),
      fixed(mean(res.map((x) => x.total))),
      `${fixed(Math.min(...res.map((x) => x.total)))}–${fixed(Math.max(...res.map((x) => x.total)))}`,
    ]);
  }
  return table(['bot (skill)', 'kills', 'objectives', 'time', 'lives', 'FF', 'total', 'range'], rows);
}

/** Side-by-side: baseline vs proposal for the same bot/skill keys. */
export function compareTable(
  baseline: readonly RunRecord[],
  proposal: readonly RunRecord[],
  proposalGrade: (total: number) => string,
): string {
  const base = groupRuns(baseline);
  const prop = groupRuns(proposal);
  const rows: string[][] = [];
  for (const [key, b] of base) {
    const p = prop.get(key) ?? [];
    const both = (runs: readonly RunRecord[]): string =>
      pct(runs.filter((r) => saved(r, 'column') && saved(r, 'outpost')).length, runs.length);
    const grades = (runs: readonly RunRecord[], fn: (r: RunRecord) => string): string => {
      const counts = new Map<string, number>();
      for (const r of runs) counts.set(fn(r), (counts.get(fn(r)) ?? 0) + 1);
      return ['S', 'A', 'B', 'C', 'D'].filter((g) => counts.has(g)).map((g) => `${g}×${counts.get(g)}`).join(' ');
    };
    rows.push([
      key,
      both(b),
      fixed(mean(b.map((r) => r.deaths)), 1),
      fixed(mean(b.map((r) => r.score))),
      grades(b, (r) => r.grade),
      clock(mean(b.map((r) => r.endTime))),
      both(p),
      pct(p.filter((r) => saved(r, 'bridgeIntact')).length, p.length),
      `${pct(p.filter((r) => saved(r, 'sam')).length, p.length)}/${pct(p.filter((r) => saved(r, 'dump')).length, p.length)}`,
      fixed(mean(p.map((r) => r.deaths)), 1),
      fixed(mean(p.map((r) => r.score))),
      grades(p, (r) => proposalGrade(r.score)),
      clock(mean(p.map((r) => r.endTime))),
    ]);
  }
  return table(
    ['bot (skill)', 'base: both', 'deaths', 'score', 'grades', 'end', 'prop: both', 'intact', 'SAM/dump', 'deaths', 'score', 'grades*', 'end'],
    rows,
  );
}
