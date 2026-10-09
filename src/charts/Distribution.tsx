import { useState } from "react";
import { scaleBand, scaleLinear } from "d3";
import type { Area } from "../lib/types";
import { pct, shortCounty } from "../lib/format";
import { useSize } from "../lib/useSize";
import { Legend } from "./Panel";

const shares = (a: Area) => {
  const total = a.brackets.reduce<number>((s, v) => s + (v ?? 0), 0);
  return a.brackets.map((v) => (total ? (v ?? 0) / total : 0));
};

// Group the 16 Census brackets into mostly $25k-wide bins.
const GROUPS: [string, number[]][] = [
  ["<$25k", [0, 1, 2, 3]],
  ["$25–50k", [4, 5, 6, 7, 8]],
  ["$50–75k", [9, 10]],
  ["$75–100k", [11]],
  ["$100–125k", [12]],
  ["$125–150k", [13]],
  ["$150–200k", [14]],
  ["$200k+", [15]],
];

const group = (s: number[]) => GROUPS.map(([, idx]) => idx.reduce((t, i) => t + s[i], 0));

export function Distribution({ state, county, stateName }: { state: Area; county: Area | null; stateName: string }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 150;
  const m = { t: 10, r: 4, b: 34, l: 32 };
  const s = group(shares(state));
  const hasCounty = !!county && county.brackets.some((v) => v != null);
  const c = hasCounty ? group(shares(county!)) : null;
  const x = scaleBand<number>()
    .domain(GROUPS.map((_, i) => i))
    .range([m.l, Math.max(m.l + 1, width - m.r)])
    .padding(0.18);
  const max = Math.max(...s, ...(c ?? [0]));
  const y = scaleLinear().domain([0, Math.ceil(max * 20) / 20]).range([h - m.b, m.t]);
  const ticks = y.ticks(4);

  return (
    <div ref={ref} className="chart">
      <Legend
        items={[
          { label: stateName, color: "var(--violet)", kind: "bar" },
          ...(hasCounty ? [{ label: shortCounty(county!.name), color: "var(--teal)", kind: "line" as const }] : []),
        ]}
      />
      {county && !hasCounty && <p className="footnote">Bracket data isn't available for {county.name}.</p>}
      {width > 0 && (
        <svg width={width} height={h} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
              <text className="axis" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {s.map((v, i) => {
            const bh = y(0) - y(v);
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect className="hit" x={x(i)! - 2} width={x.bandwidth() + 4} y={m.t} height={h - m.b - m.t} />
                <path
                  className={`bar grow ${hover != null && hover !== i ? "is-faded" : ""}`}
                  style={{ animationDelay: `${300 + i * 55}ms` }}
                  d={roundTop(x(i)!, y(0), x.bandwidth(), bh, 3)}
                />
              </g>
            );
          })}
          {c && (
            <g className="county-overlay" key={county!.name}>
              <polyline
                className="overlay-line"
                points={c.map((v, i) => `${x(i)! + x.bandwidth() / 2},${y(v)}`).join(" ")}
              />
              {c.map((v, i) => (
                <circle key={i} className="overlay-dot" cx={x(i)! + x.bandwidth() / 2} cy={y(v)} r={4} />
              ))}
            </g>
          )}
          {GROUPS.map(([label], i) => (
            <text key={label} className="axis" x={x(i)! + x.bandwidth() / 2} y={h - m.b + 14} textAnchor="middle">
              {i % 2 === 0 || width > 420 ? label.replace("$", "") : ""}
            </text>
          ))}
          <text className="axis axis-title" x={(m.l + width) / 2} y={h - 4} textAnchor="middle">
            Household income in the past 12 months ($)
          </text>
          {hover != null && (
            <g className="tip-svg" transform={`translate(${Math.min(width - 130, Math.max(m.l, x(hover)! - 40))},${m.t})`}>
              <rect width={128} height={c ? 46 : 30} rx={6} />
              <text x={8} y={13}>
                {GROUPS[hover][0]}
              </text>
              <text x={8} y={26} className="strong">
                {pct(s[hover])} of households
              </text>
              {c && (
                <text x={8} y={39} className="teal">
                  {pct(c[hover])} in {shortCounty(county!.name)}
                </text>
              )}
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

function roundTop(x: number, y0: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y0}V${y0 - h + rr}Q${x},${y0 - h} ${x + rr},${y0 - h}H${x + w - rr}Q${x + w},${y0 - h} ${x + w},${y0 - h + rr}V${y0}Z`;
}
