export function cacheSet<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Returns undefined if key not in storage, otherwise the parsed value (which may be null).
export function cacheGet<T>(key: string): T | undefined {
  try {
    const s = localStorage.getItem(key);
    if (s === null) return undefined;
    return JSON.parse(s) as T;
  } catch { return undefined; }
}
