/** Tiny persistent key/value contract (music mute preference). */
export abstract class SettingsStore {
  abstract get(key: string): string | null;
  abstract set(key: string, value: string): void;
}

/**
 * localStorage-backed store. Every access is wrapped in try/catch because storage can throw
 * (private browsing, disabled cookies, sandboxed iframes) or be missing entirely.
 */
export class LocalSettingsStore extends SettingsStore {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Preference simply won't persist.
    }
  }
}

/** In-memory store (tests, or when persistence is unwanted). */
export class MemorySettingsStore extends SettingsStore {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}
