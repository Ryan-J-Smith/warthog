/** Storage key of the progression save (one key; the format version lives inside the JSON). */
export const SAVE_KEY = 'warthog.save';

/** The part of the Web Storage API the save uses. */
export type WebStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Where the progression save lives: one opaque string. */
export abstract class SaveStorage {
  /** The stored save text, or null if there is none (or it can't be read). */
  abstract read(): string | null;
  /** Store the save text. Must not throw; a failed write just means progress won't persist. */
  abstract write(text: string): void;
}

/**
 * localStorage-backed save. Every access is wrapped in try/catch because storage can throw
 * (private browsing, disabled cookies, sandboxed iframes, quota) or be missing entirely; the
 * game then simply keeps progress in memory for the session.
 */
export class LocalSaveStorage extends SaveStorage {
  /**
   * @param backing returns the Web Storage to use (default `localStorage`); may itself throw or
   *   return undefined. Injectable so tests can hand in a broken one.
   */
  constructor(
    private readonly key: string = SAVE_KEY,
    private readonly backing: () => WebStorage | undefined = () => globalThis.localStorage,
  ) {
    super();
  }

  read(): string | null {
    try {
      return this.backing()?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
  }

  write(text: string): void {
    try {
      this.backing()?.setItem(this.key, text);
    } catch {
      // Progress simply won't persist past this session.
    }
  }
}

/** In-memory save (tests, or when persistence is unwanted). */
export class MemorySaveStorage extends SaveStorage {
  constructor(private text: string | null = null) {
    super();
  }

  read(): string | null {
    return this.text;
  }

  write(text: string): void {
    this.text = text;
  }
}
