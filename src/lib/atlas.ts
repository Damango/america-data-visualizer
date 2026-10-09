import { feature, mesh } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

export type Named = Feature<Geometry, { name: string }> & { id: string };

type Topo = Topology<{
  counties: GeometryCollection<{ name: string }>;
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
}>;

export type Atlas = {
  states: Named[];
  nation: FeatureCollection;
  borders: MultiLineString;
  /** County shapes for one state, decoded on first use. */
  countiesOf: (stateFips: string) => Named[];
};

const base = import.meta.env.BASE_URL;

let pending: Promise<Atlas> | null = null;

/** Loads the boundary file once (it is preloaded from index.html, so this usually resolves from cache). */
export function loadAtlas(): Promise<Atlas> {
  pending ??= fetch(`${base}geo/counties-10m.json`)
    .then((r) => r.json() as Promise<Topo>)
    .then((topo) => {
      const cache = new Map<string, Named[]>();
      return {
        states: (feature(topo, topo.objects.states) as unknown as { features: Named[] }).features,
        nation: feature(topo, topo.objects.nation) as FeatureCollection,
        borders: mesh(topo, topo.objects.states, (a, b) => a !== b),
        countiesOf(st) {
          let hit = cache.get(st);
          if (!hit) {
            const geometries = topo.objects.counties.geometries.filter((g) => String(g.id).startsWith(st));
            hit = (feature(topo, { type: "GeometryCollection", geometries }) as unknown as { features: Named[] }).features;
            cache.set(st, hit);
          }
          return hit;
        },
      };
    });
  return pending;
}

/** State names keyed by FIPS, for tooltips before the boundary file arrives. */
export const stateNames = (atlas: Atlas) => Object.fromEntries(atlas.states.map((s) => [s.id, s.properties.name]));
