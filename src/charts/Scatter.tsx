import { scaleLinear, scaleSqrt, type ScaleSequential } from "d3";
import type { County, MetricKey } from "../lib/types";
import { METRICS } from "../lib/types";
import { usdShort } from "../lib/format";
import { useSize } from "../lib/useSize";

export function Scatter({
  counties,
  metric,
  scale,
  focus,
  onHover,
  onPin,
}: {
  counties: County[];
  metric: MetricKey;
  scale: ScaleSequential<string>;
  focus: string | null;
  onHover: (fips: string | null) => void;
  onPin: (fips: string) => void;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const h = 165;
  const m = { t: 8, r: 10, b: 34, l: 36 };
  const pts = counties.filter((c) => c[metric] != null && c.gini != null);
  const xs = pts.map((c) => c[metric]!);
  const ys = pts.map((c) => c.gini!);
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .nice()
    .range([m.l, Math.max(m.l + 1, width - m.r)]);
  const y = scaleLinear()
    .domain([Math.min(...ys), Math.max(...ys)])
    .nice()
    .range([h - m.b, m.t]);
  const r = scaleSqrt()
    .domain([0, Math.max(...pts.map((c) => c.population ?? 0))])
    .range([2, 14]);

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={h} onPointerLeave={() => onHover(null)}>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line className="grid" x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
              <text className="axis" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {x.ticks(4).map((t) => (
            <text key={t} className="axis" x={x(t)} y={h - m.b + 14} textAnchor="middle">
              {usdShort(t)}
            </text>
          ))}
          <text className="axis axis-title" x={(m.l + width) / 2} y={h - 4} textAnchor="middle">
            {METRICS[metric].label} →
          </text>
          {pts
            .slice()
            .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
            .map((c, i) => (
              <circle
                key={c.fips}
                className={`scatter-dot ${focus === c.fips ? "is-focus" : ""}`}
                cx={x(c[metric]!)}
                cy={y(c.gini!)}
                r={r(c.population ?? 0)}
                style={{ fill: scale(c[metric]!), animationDelay: `${300 + (i % 80) * 10}ms` }}
                onPointerEnter={() => onHover(c.fips)}
                onClick={() => onPin(c.fips)}
              />
            ))}
        </svg>
      )}
      <p className="footnote">Gini index of income inequality (0 = everyone earns the same, 1 = one household earns everything) vs. county income. Bubble size is population.</p>
    </div>
  );
}
