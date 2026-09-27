import type { RadioTone } from '../../sim/types';
import { COLOR } from '../theme';

/** Radio/banner tone → colour: urgent amber, good green, bad red, info white. */
export function toneColor(tone: RadioTone): number {
  switch (tone) {
    case 'urgent':
      return COLOR.amber;
    case 'good':
      return COLOR.green;
    case 'bad':
      return COLOR.red;
    case 'info':
      return COLOR.white;
  }
}
