import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_BOUNTY,
  CHALLENGE_CATALOG,
  challengeStatuses,
  challengesFor,
  evaluateChallenges,
  type ChallengeCatalog,
} from '../../src/meta/challenges';
import { MemorySaveStorage, SAVE_VERSION, SaveStore, emptySave, parseSave } from '../../src/meta/save';
import { LEVELS } from '../../src/content/levels';
import type { MissionResults } from '../../src/sim/world';
import { missionFeats, missionResults, objective } from './fixtures';

const RIVER_OBJECTIVES = ['column', 'bridgeIntact', 'outpost', 'sam', 'dump'];

function earned(levelId: string, results: MissionResults): string[] {
  return evaluateChallenges(levelId, results).map((c) => c.id);
}

/** Victory with feats that earn nothing anywhere unless overridden. */
function run(overrides: Partial<MissionResults> = {}, feats: Parameters<typeof missionFeats>[0] = {}): MissionResults {
  return missionResults({ time: 600, feats: missionFeats(feats), ...overrides });
}

describe('challenge catalogue', () => {
  it('gives every level three challenges with unique ids', () => {
    for (const level of LEVELS) {
      const list = challengesFor(level.id);
      expect(list).toHaveLength(3);
      expect(new Set(list.map((c) => c.id)).size).toBe(3);
    }
    expect(challengesFor('nowhere')).toEqual([]);
  });

  it('names only objectives the levels really have', () => {
    const ids = (levelId: string): string[] => LEVELS.find((l) => l.id === levelId)?.objectives.map((o) => o.id) ?? [];
    expect(ids('river-crossing')).toEqual(expect.arrayContaining(RIVER_OBJECTIVES));
    expect(ids('iron-sleet')).toEqual(expect.arrayContaining(['depot', 'sam']));
  });

  it('a plain win earns nothing', () => {
    for (const level of LEVELS) expect(earned(level.id, run())).toEqual([]);
  });

  it('river crossing: clean sweep needs every objective, optional ones included', () => {
    const all = RIVER_OBJECTIVES.map((id) => objective(id, 'completed', id === 'column'));
    expect(earned('river-crossing', run({ objectives: all }))).toEqual(['clean-sweep']);
    const missedDump = all.map((o) => (o.id === 'dump' ? { ...o, status: 'failed' as const } : o));
    expect(earned('river-crossing', run({ objectives: missedDump }))).toEqual([]);
    // An empty or partial objective list never counts as a sweep.
    expect(earned('river-crossing', run({ objectives: [] }))).toEqual([]);
    expect(earned('river-crossing', run({ objectives: all.slice(0, 2) }))).toEqual([]);
  });

  it('river crossing: chain 10 and untouchable', () => {
    expect(earned('river-crossing', run({}, { bestChain: 10 }))).toEqual(['chain-10']);
    expect(earned('river-crossing', run({}, { bestChain: 9 }))).toEqual([]);
    expect(earned('river-crossing', run({}, { hullDamage: 0 }))).toEqual(['untouchable']);
    expect(earned('river-crossing', run({}, { hullDamage: 0.5 }))).toEqual([]);
    // Results without feats (older builds) can't prove a clean run.
    expect(earned('river-crossing', missionResults({ objectives: [] }))).toEqual([]);
  });

  it('three roads: blitz, gunship hunter, chain 12', () => {
    expect(earned('three-roads', run({ time: 359 }))).toEqual(['blitz']);
    expect(earned('three-roads', run({ time: 360 }))).toEqual([]);
    expect(earned('three-roads', run({}, { killsByKind: { helicopter: 3 } }))).toEqual(['gunship-hunter']);
    expect(earned('three-roads', run({}, { killsByKind: { helicopter: 2, tank: 9 } }))).toEqual([]);
    expect(earned('three-roads', run({}, { bestChain: 12 }))).toEqual(['chain-12']);
    expect(earned('three-roads', run({}, { bestChain: 11 }))).toEqual([]);
  });

  it('iron sleet: iron curtain, chain 10, deep strike', () => {
    expect(earned('iron-sleet', run({}, { escapes: 3 }))).toEqual(['iron-curtain']);
    expect(earned('iron-sleet', run({}, { escapes: 4 }))).toEqual([]);
    expect(earned('iron-sleet', run({}, { bestChain: 10 }))).toEqual(['chain-10']);
    expect(earned('iron-sleet', run({}, { bestChain: 9 }))).toEqual([]);
    const both = [objective('interdict', 'completed', true), objective('depot', 'completed'), objective('sam', 'completed')];
    expect(earned('iron-sleet', run({ objectives: both }))).toEqual(['deep-strike']);
    expect(earned('iron-sleet', run({ objectives: both.slice(0, 2) }))).toEqual([]);
  });

  it('a defeat earns nothing, however well flown', () => {
    const all = RIVER_OBJECTIVES.map((id) => objective(id, 'completed'));
    const great = { bestChain: 30, hullDamage: 0, escapes: 0, killsByKind: { helicopter: 9 } };
    for (const level of LEVELS) {
      expect(earned(level.id, run({ outcome: 'defeat', time: 60, objectives: all }, great))).toEqual([]);
    }
  });

  it('marks statuses from earned ids', () => {
    const statuses = challengeStatuses('three-roads', ['chain-12']);
    expect(statuses.map((s) => [s.challenge.id, s.earned])).toEqual([
      ['blitz', false],
      ['gunship-hunter', false],
      ['chain-12', true],
    ]);
  });
});

describe('SaveStore challenges', () => {
  const catalog: ChallengeCatalog = {
    lvl: [
      { id: 'fast', title: 'FAST', description: 'under 5:00', test: (r) => r.time < 300 },
      { id: 'big', title: 'BIG', description: 'score 30,000', test: (r) => r.total >= 30000 },
      { id: 'never', title: 'NEVER', description: 'impossible', test: () => false },
    ],
  };
  const credits = 2750; // missionCredits for the default fixture (A, 22,000).

  function fresh(text: string | null = null): { store: SaveStore; storage: MemorySaveStorage } {
    const storage = new MemorySaveStorage(text);
    return { store: new SaveStore(storage, catalog), storage };
  }

  it('pays each newly completed challenge once and returns it in the award', () => {
    const { store } = fresh();
    const award = store.recordMission('lvl', missionResults({ time: 200 }));
    expect(award.challenges.map((c) => c.id)).toEqual(['fast']);
    expect(award.bounty).toBe(CHALLENGE_BOUNTY);
    expect(award.totalCredits).toBe(credits + CHALLENGE_BOUNTY);
    expect(store.credits).toBe(credits + CHALLENGE_BOUNTY);
  });

  it('never pays again: not for the same results, nor for a later run that meets it again', () => {
    const { store } = fresh();
    const results = missionResults({ time: 200 });
    const first = store.recordMission('lvl', results);
    expect(store.recordMission('lvl', results)).toBe(first);
    expect(store.credits).toBe(credits + CHALLENGE_BOUNTY);

    const second = store.recordMission('lvl', missionResults({ time: 200, total: 30000 }));
    expect(second.challenges.map((c) => c.id)).toEqual(['big']);
    expect(second.bounty).toBe(CHALLENGE_BOUNTY);
    const third = store.recordMission('lvl', missionResults({ time: 200, total: 30000 }));
    expect(third.challenges).toEqual([]);
    expect(third.bounty).toBe(0);
    expect(third.totalCredits).toBe(third.credits.total);
    expect(store.completedChallenges('lvl')).toEqual(['fast', 'big']);
  });

  it('a defeat earns no challenge and no bounty', () => {
    const { store } = fresh();
    const award = store.recordMission('lvl', missionResults({ outcome: 'defeat', time: 100, total: 40000 }));
    expect(award.challenges).toEqual([]);
    expect(award.bounty).toBe(0);
    expect(award.totalCredits).toBe(award.credits.total);
    expect(store.completedChallenges('lvl')).toEqual([]);
  });

  it('persists completed challenges and reloads them', () => {
    const { store, storage } = fresh();
    store.recordMission('lvl', missionResults({ time: 200 }));
    const reloaded = new SaveStore(storage, catalog);
    expect(reloaded.completedChallenges('lvl')).toEqual(['fast']);
    expect(reloaded.challengeStatus('lvl').map((s) => s.earned)).toEqual([true, false, false]);
    // Reloaded, the held challenge still isn't paid again.
    expect(reloaded.recordMission('lvl', missionResults({ time: 200 })).bounty).toBe(0);
  });

  it('uses the real catalogue by default', () => {
    const store = new SaveStore(new MemorySaveStorage());
    const award = store.recordMission('three-roads', missionResults({ time: 300, feats: missionFeats() }));
    expect(award.challenges.map((c) => c.id)).toEqual(['blitz']);
    expect(store.challengeStatus('three-roads')).toHaveLength(CHALLENGE_CATALOG['three-roads']?.length ?? -1);
  });
});

describe('save migration', () => {
  it('loads a save from before challenges existed, keeping everything else', () => {
    const old = { version: SAVE_VERSION, credits: 4200, upgrades: { armor: 1 }, levels: { lvl: { bestScore: 9000, bestGrade: 'B' } }, missionsFlown: 2 };
    const save = parseSave(JSON.stringify(old));
    expect(save).toEqual({ ...old, challenges: {} });
    const store = new SaveStore(new MemorySaveStorage(JSON.stringify(old)));
    expect(store.credits).toBe(4200);
    expect(store.completedChallenges('river-crossing')).toEqual([]);
  });

  it('drops malformed challenge entries and duplicates', () => {
    const save = parseSave(
      JSON.stringify({ ...emptySave(), challenges: { a: ['x', 'x', 3, 'y'], b: 'chain-10', c: [], d: [null] } }),
    );
    expect(save.challenges).toEqual({ a: ['x', 'y'] });
    expect(parseSave(JSON.stringify({ ...emptySave(), challenges: ['oops'] })).challenges).toEqual({});
  });
});
