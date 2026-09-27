import { describe, expect, it } from 'vitest';
import { NullUiSound, UiSoundPort, resolveUiSound } from '../../src/ui/sound';

class RecordingUiSound extends UiSoundPort {
  readonly calls: string[] = [];
  move(): void {
    this.calls.push('move');
  }
  confirm(): void {
    this.calls.push('confirm');
  }
  back(): void {
    this.calls.push('back');
  }
  tick(): void {
    this.calls.push('tick');
  }
}

describe('resolveUiSound', () => {
  it('uses the registered port', () => {
    const port = new RecordingUiSound();
    const resolved = resolveUiSound(port);
    resolved.confirm();
    expect(port.calls).toEqual(['confirm']);
  });

  it('falls back to a silent port', () => {
    expect(resolveUiSound(undefined)).toBeInstanceOf(NullUiSound);
    expect(resolveUiSound({ move: () => {} })).toBeInstanceOf(NullUiSound);
  });
});
