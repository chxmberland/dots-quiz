import Globe from 'globe.gl';
import type { Capital } from './types';

type GlobeInstance = InstanceType<typeof Globe>;

let globe: GlobeInstance;
let tweenTimer: ReturnType<typeof setTimeout> | null = null;

export function initGlobe(container: HTMLElement, capitals: Capital[]): GlobeInstance {
  globe = new Globe(container)
    .width(container.clientWidth)
    .height(container.clientHeight);

  globe
    .backgroundColor('#0d1117')
    .showAtmosphere(true)
    .atmosphereColor('#1a2a4a')
    .atmosphereAltitude(0.12)
    .globeImageUrl('')
    .pointsData(capitals)
    .pointLat('lat')
    .pointLng('lng')
    .pointColor(() => 'rgba(200,200,200,0.55)')
    .pointRadius(0.3)
    .pointAltitude(0)
    .polygonsData([])
    .polygonCapColor(() => 'rgba(0,0,0,0)')
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(() => 'rgba(0,0,0,0)');

  globe.controls().autoRotate = false;
  globe.controls().enableZoom = false;
  globe.pointOfView({ altitude: 2 });

  return globe;
}

export function highlightCapital(capital: Capital, allCapitals: Capital[]) {
  const updated = allCapitals.map(c => ({
    ...c,
    _active: c.city === capital.city && c.country === capital.country,
  }));

  globe
    .pointsData(updated)
    .pointColor((d: object) => ((d as { _active?: boolean })._active ? '#ff3333' : 'rgba(200,200,200,0.55)'))
    .pointRadius((d: object) => ((d as { _active?: boolean })._active ? 0.65 : 0.3));

  rotateTo(capital.lat, capital.lng);
}

export function revealCountry(
  countryName: string,
  correct: boolean,
  geojson: { features: GeoJSONFeature[] }
) {
  const feature = geojson.features.find(
    f => f.properties.name.toLowerCase() === countryName.toLowerCase()
  );
  if (!feature) return;

  const color = correct ? 'rgba(63,185,80,0.55)' : 'rgba(255,80,80,0.55)';
  const stroke = correct ? '#3fb950' : '#ff3333';

  globe
    .polygonsData([feature])
    .polygonCapColor(() => color)
    .polygonSideColor(() => 'rgba(0,0,0,0)')
    .polygonStrokeColor(() => stroke);
}

export function clearCountry() {
  globe.polygonsData([]);
}

export function resetDots(capitals: Capital[]) {
  globe
    .pointsData(capitals)
    .pointColor(() => 'rgba(200,200,200,0.55)')
    .pointRadius(0.3);
}

function rotateTo(lat: number, lng: number) {
  if (tweenTimer) clearTimeout(tweenTimer);
  globe.controls().autoRotate = false;

  globe.pointOfView({ lat, lng, altitude: 1.5 }, 1200);

  tweenTimer = null;
}

export type GeoJSONFeature = {
  type: string;
  properties: { name: string; [key: string]: string };
  geometry: object;
};
