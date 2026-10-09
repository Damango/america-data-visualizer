import { line, scaleLinear, curveMonotoneX } from "d3";
import type { MetricKey, StateData } from "../lib/types";
import { usd, usdShort } from "../lib/format";

export function StateCompare({
  states,
  metric,
  onSelect,
}: {
  states: StateData[];
  metric: MetricKey;
  onSelect: (abbr: string) => void;
}) {
  const all = states.flatMap((s) => s.counties.map((c) => c[metric]).filter((v): v is number => v != null));
  const x = scaleLinear().domain([Math.min(...all), Math.max(...all)]).range([0, 100]);
  const sorted = [...states].sort((a, b) => (b.state[metric] ?? 0) - (a.state[metric] ?? 0));
  return (
    <div className="compare">
      {sorted.map((s, i) => {
        const vals = s.counties.map((c) => c[metric]).filter((v): v is number => v != null);
        const sx = scaleLinear().domain([0, s.trend.years.length - 1]).range([0, 72]);
        const t = s.trend.state.filter((v): v is number => v != null);
        const sy = scaleLinear().domain([Math.min(...t), Math.max(...t)]).range([22, 2]);
        const d = line<number>().x((_, j) => sx(j)).y((v) => sy(v)).curve(curveMonotoneX)(t) ?? "";
        return (
          <button key={s.abbr} className="compare-row" onClick={() => onSelect(s.abbr)} style={{ animationDelay: `${1500 + i * 120}ms` }}>
            <div className="compare-top">
              <span className="compare-name">{s.name}</span>
              <svg width={72} height={24} className="spark" aria-hidden>
                <path d={d} pathLength={1} />
              </svg>
              <span className="compare-val">{usd(s.state[metric])}</span>
            </div>
            <div className="range-strip" title="Range across counties">
              <span className="range-bar" style={{ left: `${x(Math.min(...vals))}%`, width: `${x(Math.max(...vals)) - x(Math.min(...vals))}%` }} />
              {s.state[metric] != null && <span className="range-mark" style={{ left: `${x(s.state[metric]!)}%` }} />}
            </div>
            <div className="range-labels">
              <span>County low {usdShort(Math.min(...vals))}</span>
              <span>{s.counties.length} counties</span>
              <span>High {usdShort(Math.max(...vals))}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
