export type Mode = 'daily' | 'hard' | 'endless';
export type PersistedMode = Exclude<Mode, 'endless'>;

export type Capital = {
  city: string;
  country: string;
  lat: number;
  lng: number;
};

export type GeoJSON = {
  type: string;
  features: GeoJSONFeature[];
};

export type GeoJSONFeature = {
  type: string;
  properties: { name: string; [key: string]: string };
  geometry: object;
};
