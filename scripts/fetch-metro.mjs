#!/usr/bin/env node
/**
 * fetch-metro.mjs
 *
 * Queries OpenStreetMap Overpass API for metro/subway routes in a city and
 * outputs a GeoJSON FeatureCollection where each Feature is one route line.
 *
 * Usage:
 *   node scripts/fetch-metro.mjs "London"
 *   node scripts/fetch-metro.mjs "New York City"
 *   node scripts/fetch-metro.mjs "Tokyo" --out public/data/metro/tokyo.geojson
 *
 * Output (public/data/metro/<slug>.geojson) — standard GeoJSON:
 *   {
 *     "type": "FeatureCollection",
 *     "city": "London",
 *     "features": [
 *       {
 *         "type": "Feature",
 *         "properties": { "name": "Central line", "color": "#dc241f" },
 *         "geometry": { "type": "MultiLineString", "coordinates": [[[lon,lat],...], ...] }
 *       }
 *     ]
 *   }
 *
 * Coordinates are real WGS-84 [lon, lat] pairs — load directly into
 * Leaflet, MapLibre, D3, or any GeoJSON-aware renderer.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/fetch-metro.mjs "<City Name>" [--out path/to/output.geojson]');
  process.exit(1);
}

const cityArg = args[0];
const outFlagIdx = args.indexOf('--out');
const slug = cityArg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const defaultOut = resolve(__dirname, `../public/data/metro/${slug}.geojson`);
const outPath = outFlagIdx !== -1 ? resolve(args[outFlagIdx + 1]) : defaultOut;

// ── Nominatim: city → OSM relation ID ────────────────────────────────────────

async function nominatimSearch(query, extraParams = '') {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10${extraParams}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'dots-quiz/fetch-metro (+https://github.com/your-repo)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Nominatim returned HTTP ${res.status}`);
  return res.json();
}

async function resolveAreaId(city) {
  // Try 1: settlement filter
  let results = await nominatimSearch(city, '&featuretype=settlement');
  let rel = results.find(r => r.osm_type === 'relation');

  // Try 2: no feature type filter (catches admin boundaries not tagged as settlements)
  if (!rel) {
    results = await nominatimSearch(city);
    rel = results.find(r => r.osm_type === 'relation');
  }

  if (!rel) {
    const types = [...new Set(results.map(r => `${r.osm_type}/${r.osm_id} (${r.display_name})`))].slice(0, 3);
    throw new Error(
      `No OSM relation found for "${city}".\nNominatim returned: ${types.join(', ') || 'nothing'}\n` +
      'Try a more specific name, e.g. "Cairo Governorate" or "Lagos State".'
    );
  }

  console.log(`Resolved "${city}" → OSM relation/${rel.osm_id} (${rel.display_name})`);
  return Number(rel.osm_id) + 3_600_000_000;
}

// ── Overpass query ────────────────────────────────────────────────────────────

function buildQuery(areaId) {
  return `
[out:json][timeout:60];
area(${areaId})->.searchArea;
(
  relation["route"="subway"](area.searchArea);
  relation["route"="metro"](area.searchArea);
  relation["route"="light_rail"](area.searchArea);
);
out geom;
`.trim();
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const UA = 'dots-quiz/fetch-metro (https://github.com/your-repo)';

async function queryOverpass(areaId) {
  const query = buildQuery(areaId);
  const body = new URLSearchParams({ data: query }).toString();
  const errors = [];

  for (const url of OVERPASS_ENDPOINTS) {
    console.log(`Trying ${url} …`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body,
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429) { errors.push(`${url}: rate limited (429)`); continue; }
      if (!res.ok) { errors.push(`${url}: HTTP ${res.status}`); continue; }
      return res.json();
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  throw new Error(
    'All Overpass endpoints failed:\n' + errors.map(e => '  • ' + e).join('\n') +
    '\nTry again in a few minutes or check https://overpass-api.de/api/status'
  );
}

// ── GeoJSON conversion ────────────────────────────────────────────────────────

function toFeatureCollection(elements, city) {
  const features = [];

  for (const el of elements) {
    if (el.type !== 'relation') continue;

    const name = el.tags?.name ?? el.tags?.ref ?? `Line ${el.id}`;
    const color = el.tags?.colour ?? el.tags?.color ?? el.tags?.['ref:colour'] ?? null;

    const coordinates = [];

    for (const member of el.members ?? []) {
      if (member.type !== 'way') continue;
      if (!member.geometry || member.geometry.length < 2) continue;
      // OSM geometry is [{lat, lon}] — GeoJSON wants [lon, lat]
      coordinates.push(member.geometry.map(({ lat, lon }) => [lon, lat]));
    }

    if (coordinates.length === 0) continue;

    features.push({
      type: 'Feature',
      properties: { name, ...(color ? { color } : {}) },
      geometry: { type: 'MultiLineString', coordinates },
    });
  }

  return { type: 'FeatureCollection', city, features };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let areaId;
  try {
    areaId = await resolveAreaId(cityArg);
  } catch (err) {
    console.error('Nominatim lookup failed:', err.message);
    process.exit(1);
  }

  let data;
  try {
    data = await queryOverpass(areaId);
  } catch (err) {
    console.error('Overpass query failed:', err.message);
    process.exit(1);
  }

  const elements = data.elements ?? [];
  console.log(`Found ${elements.length} relation(s).`);

  if (elements.length === 0) {
    console.warn(
      'No metro/subway relations found. Tips:\n' +
      '  • Try a more specific area name (e.g. "Greater London" instead of "London")\n' +
      '  • Check https://overpass-turbo.eu with the same query to debug'
    );
    process.exit(1);
  }

  const geojson = toFeatureCollection(elements, cityArg);
  console.log(`Extracted ${geojson.features.length} line feature(s).`);

  if (geojson.features.length === 0) {
    console.warn('Relations found but no way geometry — the area may not have full geometry exported.');
    process.exit(1);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`Wrote ${outPath}`);

  const segCount = geojson.features.reduce((n, f) => n + f.geometry.coordinates.length, 0);
  const ptCount = geojson.features.reduce(
    (n, f) => n + f.geometry.coordinates.reduce((m, s) => m + s.length, 0), 0
  );
  console.log(`  ${geojson.features.length} lines · ${segCount} segments · ${ptCount} coordinate pairs`);
}

main();
