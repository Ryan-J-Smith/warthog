import type { MissionResults } from '../../sim/world';

/** Credits paid, once, the first time a challenge is completed. */
export const CHALLENGE_BOUNTY = 600;

/**
 * One per-mission skill goal ("medal"), judged from the finished mission's results. Every
 * challenge also needs a victory (see `isChallengeEarned`), so `test` only states the skill part.
 */
export interface Challenge {
  /** Unique within its level; this is what the save remembers. */
  id: string;
  /** Short upper-case name ("CHAIN 10"). */
  title: string;
  /** One line on how to earn it. */
  description: string;
  /** The skill condition (the victory requirement is checked separately). */
  test: (results: MissionResults) => boolean;
}

/** Challenges by level id, three per mission. */
export type ChallengeCatalog = Readonly<Record<string, readonly Challenge[]>>;

// --- Predicate builders --------------------------------------------------------

/** Every objective completed, and each of `ids` present among them (so an empty list never passes). */
function everyObjective(ids: readonly string[]): (r: MissionResults) => boolean {
  return (r) => r.objectives.length > 0 && r.objectives.every((o) => o.status === 'completed') && objectivesCompleted(ids)(r);
}

/** Each of `ids` is present and completed. */
function objectivesCompleted(ids: readonly string[]): (r: MissionResults) => boolean {
  return (r) => ids.every((id) => r.objectives.some((o) => o.id === id && o.status === 'completed'));
}

function chainOf(n: number): Challenge {
  return { id: `chain-${n}`, title: `CHAIN ${n}`, description: `Build a ${n}-kill chain`, test: (r) => (r.feats?.bestChain ?? 0) >= n };
}

// --- Catalogue -----------------------------------------------------------------

export const CHALLENGE_CATALOG: ChallengeCatalog = {
  'river-crossing': [
    {
      id: 'clean-sweep',
      title: 'CLEAN SWEEP',
      description: 'Every objective, optional ones too',
      test: everyObjective(['bridgeIntact', 'outpost', 'sam', 'dump']),
    },
    chainOf(10),
    {
      id: 'untouchable',
      title: 'UNTOUCHABLE',
      description: 'Win without a scratch on the hull',
      // Bots kept under 40 hull damage on almost every run (the shield soaks most hits), so this
      // asks for none at all. Without feats (older results) there is nothing to judge.
      test: (r) => r.feats !== undefined && r.feats.hullDamage <= 0,
    },
  ],
  'three-roads': [
    { id: 'blitz', title: 'BLITZ', description: 'Win in under 6:00', test: (r) => r.time < 6 * 60 },
    {
      id: 'gunship-hunter',
      title: 'GUNSHIP HUNTER',
      description: 'Shoot down 3 helicopters',
      test: (r) => (r.feats?.killsByKind.helicopter ?? 0) >= 3,
    },
    // Bots topped out at a 5-chain here; waves bunch at the front, so 12 is reachable on purpose.
    chainOf(12),
  ],
  'iron-sleet': [
    {
      id: 'iron-curtain',
      title: 'IRON CURTAIN',
      description: 'Win with 3 or fewer escapes',
      test: (r) => r.feats !== undefined && r.feats.escapes <= 3,
    },
    // Convoys are 2-5 vehicles about 18 s apart against a 4 s chain window: 20 isn't realistic.
    chainOf(10),
    {
      id: 'deep-strike',
      title: 'DEEP STRIKE',
      description: 'Destroy the fuel depot and the SAM site',
      test: objectivesCompleted(['depot', 'sam']),
    },
  ],
  // Prototype base-defence mission: untuned guesses until it has been played.
  'hold-the-line': [
    {
      id: 'tank-buster',
      title: 'TANK BUSTER',
      description: 'Destroy 20 tanks yourself',
      test: (r) => (r.feats?.killsByKind.tank ?? 0) >= 20,
    },
    chainOf(15),
    {
      id: 'thick-skin',
      title: 'THICK SKIN',
      description: 'Win with under 60 hull damage',
      test: (r) => r.feats !== undefined && r.feats.hullDamage < 60,
    },
  ],
};
