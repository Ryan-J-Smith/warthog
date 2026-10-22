import type { SimEvent } from '../sim/events';
import type { MissionResults, WorldView } from '../sim/world';

/** Phaser scene keys. */
export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  title: 'Title',
  briefing: 'Briefing',
  game: 'Game',
  hud: 'Hud',
  pause: 'Pause',
  results: 'Results',
  levelSelect: 'LevelSelect',
  hangar: 'Hangar',
} as const;

/** Events emitted on the Game scene's event emitter (`scene.get(SCENES.game).events`). */
export const GAME_EVENTS = {
  /** Every rendered frame: `(view: WorldView, events: readonly SimEvent[])`. */
  frame: 'warthog-frame',
  /** Mission ended; results screen follows shortly: `(results: MissionResults)`. */
  ended: 'warthog-ended',
} as const;

export type FrameHandler = (view: WorldView, events: readonly SimEvent[]) => void;
export type EndedHandler = (results: MissionResults) => void;

export interface BriefingSceneData {
  levelId: string;
}

export interface GameSceneData {
  levelId: string;
}

export interface HudSceneData {
  levelId: string;
}

export interface PauseSceneData {
  levelId: string;
}

export interface ResultsSceneData {
  levelId: string;
  results: MissionResults;
}

export interface HangarSceneData {
  /** Opened from a results screen: ESC goes back to it (the mission is not paid again). */
  returnTo?: ResultsSceneData;
}
