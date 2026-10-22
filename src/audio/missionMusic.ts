import type { AudioKey } from '../assets';

/** In-mission music track per level id. Levels not listed here play `musicMission`. */
export const MISSION_MUSIC: Readonly<Record<string, AudioKey>> = {
  'river-crossing': 'musicMission',
  'three-roads': 'musicThreeRoads',
  'iron-sleet': 'musicIronSleet',
};

/** The in-mission track for `levelId`, falling back to `musicMission` for unknown (or no) levels. */
export function missionMusicKey(levelId?: string): AudioKey {
  const key = levelId !== undefined && Object.hasOwn(MISSION_MUSIC, levelId) ? MISSION_MUSIC[levelId] : undefined;
  return key ?? 'musicMission';
}
