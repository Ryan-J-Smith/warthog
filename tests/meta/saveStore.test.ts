import { describe, expect, it } from 'vitest';
import {
  LocalSaveStorage,
  MemorySaveStorage,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  emptySave,
  parseSave,
  serializeSave,
  type WebStorage,
} from '../../src/meta/save';
import { buildLoadout } from '../../src/meta/upgrades';
import { missionResults } from './fixtures';

function storeWith(save: object | string | null): { store: SaveStore; storage: MemorySaveStorage } {
  const text = save === null || typeof save === 'string' ? save : JSON.stringify(save);
  const storage = new MemorySaveStorage(text);
  return { store: new SaveStore(storage), storage };
}

describe('parseSave', () => {
  it('starts fresh with no save', () => {
    expect(parseSave(null)).toEqual(emptySave());
  });

  it('starts fresh on corrupted JSON', () => {
    expect(parseSave('{"version":1,"credits":')).toEqual(emptySave());
    expect(parseSave('not json at all')).toEqual(emptySave());
    expect(parseSave('[1,2,3]')).toEqual(emptySave());
  });

  it('starts fresh on a version mismatch', () => {
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION + 1, credits: 5000 }))).toEqual(emptySave());
    expect(parseSave(JSON.stringify({ credits: 5000 }))).toEqual(emptySave());
  });

  it('round-trips a save', () => {
    const save = { ...emptySave(), credits: 1234, upgrades: { armor: 2 }, levels: { a: { bestScore: 100, bestGrade: 'B' } }, missionsFlown: 3 };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('drops or clamps bad fields instead of failing the whole save', () => {
    const save = parseSave(
      JSON.stringify({
        version: SAVE_VERSION,
        credits: -50,
        missionsFlown: 'many',
        upgrades: { armor: 9, shield: 1.7, bogus: 2, gun: 'x' },
        levels: { good: { bestScore: 900, bestGrade: 'A' }, bad: { bestScore: 'x' }, worse: 7 },
      }),
    );
    expect(save.credits).toBe(0);
    expect(save.missionsFlown).toBe(0);
    expect(save.upgrades).toEqual({ armor: 3, shield: 1 });
    expect(save.levels).toEqual({ good: { bestScore: 900, bestGrade: 'A' } });
  });
});

describe('SaveStore', () => {
  it('persists every change and reloads it', () => {
    const { store, storage } = storeWith(null);
    store.recordMission('river-crossing', missionResults({ total: 22000, grade: 'A' }));
    store.buy('armor');
    const reloaded = new SaveStore(storage);
    expect(reloaded.credits).toBe(2750 - 1100);
    expect(reloaded.level('armor')).toBe(1);
    expect(reloaded.missionsFlown).toBe(1);
    expect(reloaded.bestFor('river-crossing')).toEqual({ bestScore: 22000, bestGrade: 'A' });
    expect(reloaded.loadout()).toEqual(buildLoadout({ armor: 1 }));
  });

  it('buys while affordable, then refuses without spending', () => {
    const { store } = storeWith({ ...emptySave(), credits: 2000 });
    expect(store.buy('armor').ok).toBe(true);
    const refused = store.buy('armor');
    expect(refused).toEqual({ ok: false, reason: 'credits', cost: 1600, short: 700 });
    expect(store.credits).toBe(900);
    expect(store.level('armor')).toBe(1);
  });

  it('refuses past the max level without spending', () => {
    const { store } = storeWith({ ...emptySave(), credits: 100000, upgrades: { armor: 3 } });
    expect(store.buy('armor')).toEqual({ ok: false, reason: 'maxed' });
    expect(store.credits).toBe(100000);
  });

  it('pays a mission once, even if the results screen is entered again', () => {
    const { store } = storeWith(null);
    const results = missionResults({ total: 22000, grade: 'A' });
    const first = store.recordMission('river-crossing', results);
    const again = store.recordMission('river-crossing', results);
    expect(again).toBe(first);
    expect(store.credits).toBe(2750);
    expect(store.missionsFlown).toBe(1);
    expect(store.awardFor(results)).toBe(first);
    expect(store.awardFor(missionResults())).toBeNull();
  });

  it('keeps the best score and the best grade per level', () => {
    const { store } = storeWith(null);
    const first = store.recordMission('lvl', missionResults({ total: 20000, grade: 'B' }));
    expect(first).toMatchObject({ newBestScore: true, newBestGrade: true, previous: null });
    const worse = store.recordMission('lvl', missionResults({ outcome: 'defeat', total: 5000, grade: 'D' }));
    expect(worse).toMatchObject({ newBestScore: false, newBestGrade: false, previous: { bestScore: 20000, bestGrade: 'B' } });
    const better = store.recordMission('lvl', missionResults({ total: 31000, grade: 'S' }));
    expect(better).toMatchObject({ newBestScore: true, newBestGrade: true });
    expect(store.bestFor('lvl')).toEqual({ bestScore: 31000, bestGrade: 'S' });
    expect(store.bestFor('other')).toBeNull();
    expect(store.missionsFlown).toBe(3);
  });

  it('works fully in memory when storage throws', () => {
    const throwing = (): WebStorage => ({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const store = new SaveStore(new LocalSaveStorage('test.save', throwing));
    store.recordMission('lvl', missionResults());
    expect(store.credits).toBe(2750);
    expect(store.buy('armor').ok).toBe(true);
    expect(store.level('armor')).toBe(1);
  });

  it('works when storage is missing entirely', () => {
    const store = new SaveStore(new LocalSaveStorage('test.save', () => undefined));
    store.recordMission('lvl', missionResults());
    expect(store.credits).toBe(2750);
  });
});

describe('LocalSaveStorage', () => {
  it('reads and writes its key', () => {
    const values = new Map<string, string>();
    const backing: WebStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => void values.set(k, v) };
    const storage = new LocalSaveStorage(SAVE_KEY, () => backing);
    expect(storage.read()).toBeNull();
    storage.write('{"version":1}');
    expect(values.get(SAVE_KEY)).toBe('{"version":1}');
    expect(storage.read()).toBe('{"version":1}');
  });
});
