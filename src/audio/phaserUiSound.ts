import type Phaser from 'phaser';
import { UI_SOUND_REGISTRY_KEY, UiSoundPort } from '../ui/sound';
import { playUiSound } from './loadAllAudio';

/** Menu/HUD sounds for the UI track's `UiSoundPort` contract. */
export class PhaserUiSound extends UiSoundPort {
  constructor(private readonly scene: Phaser.Scene) {
    super();
  }

  move(): void {
    playUiSound(this.scene, 'uiMove');
  }

  confirm(): void {
    playUiSound(this.scene, 'uiConfirm');
  }

  back(): void {
    playUiSound(this.scene, 'uiBack');
  }

  tick(): void {
    playUiSound(this.scene, 'scoreTick');
  }

  /** Hangar purchase ("ka-ching"). Not on `UiSoundPort` yet: see the port's owner. */
  purchase(): void {
    playUiSound(this.scene, 'upgradeBuy');
  }

  /** Denied / error (e.g. not enough credits). Not on `UiSoundPort` yet: see the port's owner. */
  error(): void {
    playUiSound(this.scene, 'uiError');
  }
}

/**
 * Put a `PhaserUiSound` in the game registry so UI scenes (`resolveUiSound(this.registry.get(UI_SOUND_REGISTRY_KEY))`) find it.
 * Call once after audio has loaded, e.g. in PreloadScene.create().
 */
export function registerUiSound(scene: Phaser.Scene): UiSoundPort {
  const port = new PhaserUiSound(scene);
  scene.registry.set(UI_SOUND_REGISTRY_KEY, port);
  return port;
}
