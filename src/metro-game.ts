import * as L from 'leaflet';
import { isCorrect } from './match';
import { randomShuffle } from './seed';

type MetroFeature = {
  type: 'Feature';
  properties: { name?: string; color?: string };
  geometry: { type: 'MultiLineString'; coordinates: number[][][] };
};

type MetroGeoJSON = {
  type: 'FeatureCollection';
  city: string;
  features: MetroFeature[];
};

type CityEntry = { city: string; slug: string };

let index: CityEntry[] = [];
let queue: CityEntry[] = [];
let queuePos = 0;
let current: MetroGeoJSON | null = null;
let answering = false;
let leafletMap: L.Map | null = null;
let metroLayer: L.GeoJSON | null = null;

const mapDiv    = document.getElementById('metro-map') as HTMLDivElement;
const input     = document.getElementById('metro-input') as HTMLInputElement;
const submitBtn = document.getElementById('metro-submit') as HTMLButtonElement;
const feedback  = document.getElementById('metro-feedback') as HTMLDivElement;
const hintBtn   = document.getElementById('metro-hint') as HTMLButtonElement;

export async function initMetroGame() {
  const res = await fetch('/data/metro/index.json');
  index = await res.json();
  queue = randomShuffle(index);
  queuePos = 0;
  initMap();
  wireListeners();
  await loadNext();
}

function initMap() {
  leafletMap = L.map('metro-map', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    zoomSnap: 0,
    zoomDelta: 0,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(leafletMap);
}

function wireListeners() {
  submitBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  hintBtn.addEventListener('click', () => {
    if (!current) return;
    hintBtn.textContent = current.city.replace(/[a-zA-Z]/g, '·');
    hintBtn.disabled = true;
  });
}

async function loadNext() {
  // Hide tiles for the next question
  mapDiv.classList.remove('show-tiles');

  if (queuePos >= queue.length) {
    queue = randomShuffle(index);
    queuePos = 0;
  }
  const entry = queue[queuePos++];

  setFeedback('', false);
  input.value = '';
  input.disabled = false;
  submitBtn.disabled = false;
  hintBtn.textContent = 'Hint';
  hintBtn.disabled = false;
  answering = true;

  const res = await fetch(`/data/metro/${entry.slug}.geojson`);
  current = await res.json();
  showLines(current!);
  input.focus();
}

function showLines(geo: MetroGeoJSON) {
  // Constrain map to the space above the game UI
  const gameUi = document.querySelector<HTMLElement>('#screen-metro .game-ui');
  const uiHeight = gameUi ? gameUi.offsetHeight + 32 : 200;
  mapDiv.style.height = `calc(100% - ${uiHeight}px)`;
  leafletMap!.invalidateSize();

  if (metroLayer) {
    metroLayer.remove();
    metroLayer = null;
  }

  metroLayer = L.geoJSON(geo as GeoJSON.FeatureCollection, {
    style: (feature) => ({
      color: feature?.properties?.color ?? '#58a6ff',
      weight: 2.5,
      opacity: 0.85,
    }),
  }).addTo(leafletMap!);

  const bounds = metroLayer.getBounds();
  if (bounds.isValid()) {
    const pad = Math.min(mapDiv.offsetWidth, mapDiv.offsetHeight) * 0.08;
    leafletMap!.fitBounds(bounds, { padding: [pad, pad], animate: false });
  }
}

function submit() {
  if (!answering || !current) return;
  resolveGuess(isCorrect(input.value, current.city));
}

function resolveGuess(correct: boolean) {
  if (!answering || !current) return;
  answering = false;
  input.disabled = true;
  submitBtn.disabled = true;

  setFeedback(correct ? `Correct! ${current.city}` : `It was ${current.city}`, correct);

  // Fade in the map tiles — lines stay exactly where they are
  mapDiv.classList.add('show-tiles');

  setTimeout(() => loadNext(), correct ? 2500 : 4000);
}

function setFeedback(msg: string, correct: boolean) {
  feedback.textContent = msg;
  feedback.className = msg ? `visible ${correct ? 'correct' : 'wrong'}` : '';
}
