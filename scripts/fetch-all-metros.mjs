#!/usr/bin/env node
/**
 * Runs fetch-metro.mjs for every city in cities.json.
 * Adds a 2-second pause between requests to avoid rate limiting.
 *
 * Usage:
 *   node scripts/fetch-all-metros.mjs
 *   node scripts/fetch-all-metros.mjs --country US   # filter by country
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cities = JSON.parse(readFileSync(resolve(__dirname, 'cities.json'), 'utf8'));

const countryFilter = (() => {
  const idx = process.argv.indexOf('--country');
  if (idx === -1) return null;
  return process.argv[idx + 1].toUpperCase().split(',').map(s => s.trim());
})();

const targets = countryFilter ? cities.filter(c => countryFilter.includes(c.country)) : cities;

console.log(`Fetching ${targets.length} cities…\n`);

const failed = [];

for (const { city, system } of targets) {
  console.log(`\n── ${city} (${system}) ──`);
  try {
    execSync(`node ${resolve(__dirname, 'fetch-metro.mjs')} "${city}"`, { stdio: 'inherit' });
  } catch {
    console.error(`  FAILED: ${city}`);
    failed.push(city);
  }
  await new Promise(r => setTimeout(r, 2000));
}

console.log('\nDone.');
if (failed.length > 0) {
  console.log(`\nFailed cities (${failed.length}):`);
  failed.forEach(c => console.log(`  • ${c}`));
}
