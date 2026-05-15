#!/usr/bin/env node
/**
 * Scans public/data/metro/*.geojson and writes public/data/metro/index.json
 * Run this after fetch-all-metros.mjs to update the available city list.
 *
 * Usage: node scripts/build-metro-index.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const metroDir = resolve(__dirname, '../public/data/metro');

const files = readdirSync(metroDir).filter(f => f.endsWith('.geojson'));

const index = files.map(file => {
  const slug = basename(file, '.geojson');
  const data = JSON.parse(readFileSync(resolve(metroDir, file), 'utf8'));
  return { city: data.city ?? slug, slug };
}).sort((a, b) => a.city.localeCompare(b.city));

const outPath = resolve(metroDir, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2));
console.log(`Wrote ${outPath} — ${index.length} cities`);
