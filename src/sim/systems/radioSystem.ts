import { isTriggerMet } from '../triggers';
import { SimSystem, type StepContext } from './simSystem';

/** Plays each scripted radio cue once when its trigger is met. */
export class RadioSystem extends SimSystem {
  update({ world }: StepContext): void {
    world.level.radio.forEach((cue, index) => {
      if (world.playedRadio.has(index) || !isTriggerMet(world, cue.trigger)) return;
      world.playedRadio.add(index);
      world.emit({ type: 'radio', speaker: cue.speaker, text: cue.text, tone: cue.tone });
    });
  }
}
