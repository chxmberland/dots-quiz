import { todayISO } from './seed';

type PlayRecord = { date: string; done: boolean; score: number };

const KEY = 'cq_played';

export function clearPlayRecord() {
  document.cookie = `${KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function getPlayRecord(): PlayRecord | null {
  const raw = document.cookie
    .split('; ')
    .find(row => row.startsWith(KEY + '='));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.slice(KEY.length + 1)));
  } catch {
    return null;
  }
}

export function hasPlayedToday(): boolean {
  const rec = getPlayRecord();
  return !!rec && rec.date === todayISO() && rec.done;
}

export function saveResult(score: number) {
  const payload = JSON.stringify({ date: todayISO(), done: true, score });
  const expires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${KEY}=${encodeURIComponent(payload)}; expires=${expires}; path=/; SameSite=Lax`;
}
