import type { ScaleSequential } from "d3";
import type { MetricKey, StateData } from "../lib/types";
import { usd } from "../lib/format";

export function StateRank({
  states,
  metric,
  scale,
  focus,
  onSelect,
  onHover,
}: {
  states: StateData[];
  metric: MetricKey;
  scale: ScaleSequential<string>;
  focus: string | null;
  onSelect: (abbr: string) => void;
  onHover: (fips: string | null) => void;
}) {
  const sorted = [...states].filter((s) => s.state[metric] != null).sort((a, b) => b.state[metric]! - a.state[metric]!);
  const max = sorted[0]?.state[metric] ?? 1;
  const min = sorted[sorted.length - 1]?.state[metric] ?? 0;
  // Bars start a bit below the lowest state so the differences read clearly.
  const floor = min - (max - min) * 0.35;
  return (
    <ol className="rank" onPointerLeave={() => onHover(null)}>
      {sorted.map((s, i) => {
        const v = s.state[metric]!;
        const delay = 1450 + Math.min(i, 14) * 45;
        return (
          <li key={s.abbr} style={{ animationDelay: `${delay}ms` }}>
            <button
              className={`rank-row ${focus === s.fips ? "is-focus" : ""}`}
              onClick={() => onSelect(s.abbr)}
              onPointerEnter={() => onHover(s.fips)}
              onFocus={() => onHover(s.fips)}
              onBlur={() => onHover(null)}
            >
              <span className="rank-n">{i + 1}</span>
              <span className="rank-name">
                {s.name}
                {s.counties.length > 0 && <i className="rank-dot" title="County data available" />}
              </span>
              <span className="rank-track">
                <span className="rank-bar" style={{ width: `${((v - floor) / (max - floor)) * 100}%`, background: scale(v), animationDelay: `${delay + 200}ms` }} />
              </span>
              <span className="rank-val">{usd(v)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
