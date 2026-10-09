import type { ScaleSequential } from "d3";
import type { County, MetricKey } from "../lib/types";
import { RAMP } from "../lib/color";
import { shortCounty, usd, usdShort } from "../lib/format";

export function Extremes({
  counties,
  metric,
  scale,
  focusValue,
  onPin,
  unit = "county",
}: {
  counties: County[];
  metric: MetricKey;
  scale: ScaleSequential<string>;
  focusValue: number | null;
  onPin: (fips: string) => void;
  unit?: "county" | "state";
}) {
  const valid = counties.filter((c) => c[metric] != null).sort((a, b) => b[metric]! - a[metric]!);
  const top = valid[0];
  const bottom = valid[valid.length - 1];
  const [lo, hi] = scale.domain();
  const pos = focusValue != null ? Math.max(0, Math.min(1, (focusValue - lo) / (hi - lo))) : null;
  const ratio = top && bottom ? top[metric]! / bottom[metric]! : null;
  return (
    <div className="extremes">
      <div className="ext-row">
        {top && (
          <button className="ext-card" onClick={() => onPin(top.fips)}>
            <span className="ext-icon up">↑</span>
            <span>
              <span className="ext-name">{shortCounty(top.name)}</span>
              <span className="ext-val">{usd(top[metric])}</span>
            </span>
          </button>
        )}
        {bottom && (
          <button className="ext-card" onClick={() => onPin(bottom.fips)}>
            <span className="ext-icon down">↓</span>
            <span>
              <span className="ext-name">{shortCounty(bottom.name)}</span>
              <span className="ext-val">{usd(bottom[metric])}</span>
            </span>
          </button>
        )}
      </div>
      {ratio && <p className="ext-note">The top {unit} earns {ratio.toFixed(1)}× the bottom {unit}.</p>}
      <div className="ramp-wrap">
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }}>
          {pos != null && <span className="ramp-marker" style={{ left: `${pos * 100}%`, background: scale(focusValue!) }} />}
        </div>
        <div className="ramp-labels">
          <span>{usdShort(lo)} or less</span>
          <span>{usdShort((lo + hi) / 2)}</span>
          <span>{usdShort(hi)}+</span>
        </div>
      </div>
    </div>
  );
}
