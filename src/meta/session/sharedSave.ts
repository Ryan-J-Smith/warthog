import type Phaser from 'phaser';
import { REGISTRY } from '../../assets';
import type { PlayerLoadout } from '../../sim/loadout';
import { LocalSaveStorage, SaveStore } from '../save';

/**
 * The game's one `SaveStore`, kept in the Phaser registry under `REGISTRY.metaSave` (created on
 * first use, persisted in localStorage). Every scene that reads or changes progression uses this.
 */
export function saveStoreFor(game: Phaser.Game): SaveStore {
  const registered: unknown = game.registry.get(REGISTRY.metaSave);
  if (registered instanceof SaveStore) return registered;
  const store = new SaveStore(new LocalSaveStorage());
  game.registry.set(REGISTRY.metaSave, store);
  return store;
}

/** The player's upgraded aircraft, for `new Simulation(level, seed, systems, loadout)`. */
export function loadoutForGame(game: Phaser.Game): PlayerLoadout {
  return saveStoreFor(game).loadout();
}
