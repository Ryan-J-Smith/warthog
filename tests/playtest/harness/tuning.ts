/**
 * Prototype-only tuning overrides for playtests.
 *
 * The simulation reads its tuning tables (`src/config`) at call time, so a playtest can try a
 * proposed value by overriding a table field for the duration of one experiment and putting
 * it back afterwards. This is NOT a pattern for production code or unit tests; it exists so
 * the fun review can prove a recommendation before the lead edits `src/config` for real.
 * Level-data changes should instead use a modified copy of the `LevelDefinition`.
 */

/** Mutable view of a config table with literal types widened (`as const` tables). */
type Writable<T> = {
  -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends string ? string : T[K] extends boolean ? boolean : T[K];
};

/** One reversible change. */
export type Override = () => () => void;

/** Override some fields of a config object; returns the override (apply → restore). */
export function set<T extends object>(table: T, patch: Partial<Writable<T>>): Override {
  return () => {
    const writable = table as Writable<T>;
    const saved: Partial<Writable<T>> = {};
    for (const key of Object.keys(patch) as Array<keyof T>) {
      saved[key] = writable[key];
      writable[key] = patch[key] as Writable<T>[keyof T];
    }
    return () => {
      for (const key of Object.keys(saved) as Array<keyof T>) writable[key] = saved[key] as Writable<T>[keyof T];
    };
  };
}

/** Run `fn` with the overrides applied, always restoring them. */
export function withTuning<R>(overrides: readonly Override[], fn: () => R): R {
  const restores = overrides.map((apply) => apply());
  try {
    return fn();
  } finally {
    for (const restore of restores.reverse()) restore();
  }
}
