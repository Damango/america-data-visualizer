import { interpolateRgbBasis, quantile, scaleSequential } from "d3";

// Low -> high: deep indigo, violet, blue, teal, gold. Brighter = higher income on the dark surface.
export const RAMP = ["#22124f", "#5a2bd4", "#3f7df0", "#25c6b4", "#f6d84a"];
export const interp = interpolateRgbBasis(RAMP);

export function makeScale(values: number[]) {
  const sorted = values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  const lo = quantile(sorted, 0.02) ?? 0;
  const hi = quantile(sorted, 0.98) ?? 1;
  return scaleSequential(interp).domain([lo, hi]).clamp(true);
}
