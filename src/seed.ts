export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr];
  let s = hashSeed(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    s = lcg(s);
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h || 1;
}

function lcg(s: number): number {
  return ((s * 1664525 + 1013904223) >>> 0);
}

export function randomShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
