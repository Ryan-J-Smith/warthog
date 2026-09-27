/**
 * Contract for menu/HUD sounds. The audio track provides the real implementation and puts it in
 * the Phaser registry under `UI_SOUND_REGISTRY_KEY`; UI scenes fall back to `NullUiSound`.
 */
export abstract class UiSoundPort {
  /** Selection moved (menu up/down). */
  abstract move(): void;
  /** Selection confirmed. */
  abstract confirm(): void;
  /** Back / cancel / close a panel. */
  abstract back(): void;
  /** A counter ticked (results screen count-up). Called at most ~20 times a second. */
  abstract tick(): void;
}

/** Silent implementation used until real audio is wired in. */
export class NullUiSound extends UiSoundPort {
  move(): void {}
  confirm(): void {}
  back(): void {}
  tick(): void {}
}

/** Phaser registry key under which the audio track stores its `UiSoundPort`. */
export const UI_SOUND_REGISTRY_KEY = 'uiSound';

/**
 * The registered `UiSoundPort`, or a `NullUiSound` if none is registered.
 * Pass the registry value: `resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY))`.
 */
export function resolveUiSound(registered: unknown): UiSoundPort {
  return registered instanceof UiSoundPort ? registered : new NullUiSound();
}
