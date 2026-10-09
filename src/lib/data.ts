import type { Manifest, StateData } from "./types";

const base = import.meta.env.BASE_URL;

export async function loadAll(): Promise<Record<string, StateData>> {
  let manifest: Manifest;
  try {
    const res = await fetch(`${base}data/manifest.json`);
    if (!res.ok) return {};
    manifest = await res.json();
  } catch {
    return {};
  }
  const entries = await Promise.all(
    Object.keys(manifest.states).map(async (abbr) => {
      const res = await fetch(`${base}data/states/${abbr}.json`);
      return res.ok ? ([abbr, (await res.json()) as StateData] as const) : null;
    }),
  );
  const out: Record<string, StateData> = {};
  for (const e of entries) if (e) out[e[0]] = e[1];
  return out;
}
