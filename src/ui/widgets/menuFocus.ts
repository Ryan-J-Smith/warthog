import type { MenuList } from './menuList';
import type { SoundSettingsPanel } from './soundSettingsPanel';

/**
 * Keyboard focus across a `MenuList` followed by a `SoundSettingsPanel`: ↑/↓ walk through the menu
 * items and then the sound rows (wrapping), ←/→ change the focused row's volume, ENTER confirms
 * the menu item or toggles the row's mute. Pointer hover moves the focus too.
 *
 * Wire the menu's `onMove` to `menuFocused()` and the panel's `onFocusRequest` to `focusRow()`.
 */
export class MenuFocus {
  constructor(
    private readonly menu: MenuList,
    private readonly panel: SoundSettingsPanel,
  ) {}

  up(): void {
    if (!this.menu.enabled) return;
    const row = this.panel.focusedRow;
    if (row !== null) {
      if (row > 0) this.panel.focus(row - 1, true);
      else this.menu.select(this.menu.count - 1, true);
    } else if (this.menu.selected === 0) this.focusRow(this.panel.rows - 1, true);
    else this.menu.move(-1);
  }

  down(): void {
    if (!this.menu.enabled) return;
    const row = this.panel.focusedRow;
    if (row !== null) {
      if (row < this.panel.rows - 1) this.panel.focus(row + 1, true);
      else this.menu.select(0, true);
    } else if (this.menu.selected === this.menu.count - 1) this.focusRow(0, true);
    else this.menu.move(1);
  }

  left(): void {
    if (this.menu.enabled) this.panel.adjust(-1);
  }

  right(): void {
    if (this.menu.enabled) this.panel.adjust(1);
  }

  confirm(): void {
    if (!this.menu.enabled) return;
    if (this.panel.focusedRow !== null) this.panel.toggle();
    else this.menu.confirm();
  }

  /** The menu took the selection (keyboard or pointer): the sound rows lose focus. */
  menuFocused(): void {
    this.panel.focus(null);
  }

  /** Give keyboard focus to a sound row. */
  focusRow(row: number, withSound = false): void {
    this.menu.setFocused(false);
    this.panel.focus(row, withSound);
  }
}
