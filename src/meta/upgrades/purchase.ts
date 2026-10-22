import { levelOf, nextCost, type UpgradeId, type UpgradeLevels } from './upgradeCatalog';

export type PurchaseCheck =
  | { ok: true; cost: number; level: number }
  | { ok: false; reason: 'maxed' }
  | { ok: false; reason: 'credits'; cost: number; short: number };

/**
 * Can the player buy the next level of `id`? `level` is the level owned after buying. Pure; the
 * save store applies a successful purchase.
 */
export function checkPurchase(levels: UpgradeLevels, credits: number, id: UpgradeId): PurchaseCheck {
  const cost = nextCost(levels, id);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (credits < cost) return { ok: false, reason: 'credits', cost, short: cost - credits };
  return { ok: true, cost, level: levelOf(levels, id) + 1 };
}
