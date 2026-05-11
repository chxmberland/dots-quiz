import { distance } from 'fastest-levenshtein';

const ALIASES: Record<string, string[]> = {
  'Beijing': ['Peking', 'Bejing'],
  'Kyiv': ['Kiev'],
  'Mumbai': ['Bombay'],
  'Chennai': ['Madras'],
  'Kolkata': ['Calcutta'],
  'Yangon': ['Rangoon'],
  'Ulaanbaatar': ['Ulan Bator', 'Ulaanbator'],
  "N'Djamena": ['Ndjamena', 'N Djamena'],
  "Nuku'alofa": ['Nukualofa'],
  "São Tomé": ['Sao Tome'],
  'Valletta': ['Valetta'],
  'Dili': ['Díli'],
};

function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`\-]/g, '')
    .toLowerCase()
    .trim();
}

export function isCorrect(guess: string, answer: string): boolean {
  const g = normalise(guess);
  const a = normalise(answer);
  if (g === a) return true;

  const aliases = ALIASES[answer] ?? [];
  if (aliases.some(alias => normalise(alias) === g)) return true;

  if (a.length >= 6 && distance(g, a) <= 1) return true;

  return false;
}
