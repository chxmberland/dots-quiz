import { todayISO } from './seed';
import type { PersistedMode } from './types';

type PlayRecord = { date: string; done: boolean; score: number };

const KEYS: Record<PersistedMode, string> = {
  daily: 'cq_played_daily',
  hard: 'cq_played_hard',
};

export function clearPlayRecord() {
  for (const key of Object.values(KEYS)) {
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

export function getPlayRecord(mode: PersistedMode): PlayRecord | null {
  const key = KEYS[mode];
  const raw = document.cookie
    .split('; ')
    .find(row => row.startsWith(key + '='));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(key.length + 1)));
  } catch {
    return null;
  }
}

export function hasPlayedToday(mode: PersistedMode): boolean {
  const rec = getPlayRecord(mode);
  return !!rec && rec.date === todayISO() && rec.done;
}

export function saveResult(mode: PersistedMode, score: number) {
  const key = KEYS[mode];
  const payload = JSON.stringify({ date: todayISO(), done: true, score });
  const expires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${key}=${encodeURIComponent(payload)}; expires=${expires}; path=/; SameSite=Lax`;
}
