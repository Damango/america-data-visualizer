import { useState } from "react";
import { area as d3area, line, scaleLinear } from "d3";
import type { StateData } from "../lib/types";
import { shortCounty, usd, usdShort } from "../lib/format";
import { useSize } from "../lib/useSize";
import { Legend } from "./Panel";

export function Trend({ data, countyFips }: { data: StateData; countyFips: string | null }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const { years, state } = data.trend;
  const county = countyFips ? data.trend.counties[countyFips] : null;
  const countyName = countyFips ? data.counties.find((c) => c.fips === countyFips)?.name : null;
  const h = 150;
  const m = { t: 14, r: 14, b: 22, l: 44 };
  const vals = [...state, ...(county ?? [])].filter((v): v is number => v != null);
  if (!years.length) return <p className="muted">No trend data.</p>;
  const x = scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([m.l, Math.max(m.l + 1, width - m.r)]);
  const y = scaleLinear()
    .domain([Math.min(...vals) * 0.92, Math.max(...vals) * 1.04])
    .nice(4)
    .range([h - m.b, m.t]);
  const ln = line<number | null>()
    .defined((v) => v != null)
    .x((_, i) => x(years[i]))
    .y((v) => y(v!));
  const ar = d3area<number | null>()
    .defined((v) => v != null)
    .x((_, i) => x(years[i]))
    .y0(h - m.b)
    .y1((v) => y(v!));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    years.forEach((yr, i) => {
      if (Math.abs(x(yr) - px) < Math.abs(x(years[best]) - px)) best = i;
    });
    setHi(best);
  };

  const first = state.find((v) => v != null) ?? null;
  const last = state[state.length - 1];
  const growth = first && last ? last / first - 1 : null;

  return (
    <div ref={ref} className="chart">
      <div className="trend-head">
        <Legend
          items={[
            { label: data.name, color: "var(--violet)", kind: "line" },
            ...(countyName ? [{ label: shortCounty(countyName), color: "var(--teal)", kind: "line" as const }] : []),
          ]}
        />
        {growth != null && (
          <span className="delta">
            {growth >= 0 ? "▲" : "▼"} {(growth * 100).toFixed(0)}% since {years[0] - 4}–{String(years[0]).slice(2)}
          </span>
        )}
      </div>
      {width > 0 && (
        <svg width={width} height={h} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
          <defs>
            <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--violet)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line className="grid" x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
              <text className="axis" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {usdShort(t)}
              </text>
            </g>
          ))}
          {years.map((yr, i) => (
            <text key={yr} className="axis" x={x(yr)} y={h - 6} textAnchor={i === 0 ? "start" : i === years.length - 1 ? "end" : "middle"}>
              {yr - 4}–{String(yr).slice(2)}
            </text>
          ))}
          <path className="area fade-in" d={ar(state) ?? ""} fill="url(#trend-fill)" />
          <path className="line draw violet" d={ln(state) ?? ""} pathLength={1} />
          {county && <path key={countyFips} className="line draw teal" d={ln(county) ?? ""} pathLength={1} />}
          {state.map((v, i) =>
            v == null ? null : (
              <circle key={i} className="end-dot violet" style={{ animationDelay: `${700 + i * 450}ms` }} cx={x(years[i])} cy={y(v)} r={4} />
            ),
          )}
          {county?.map((v, i) =>
            v == null ? null : <circle key={`c${countyFips}${i}`} className="pt-dot teal" cx={x(years[i])} cy={y(v)} r={3.5} />,
          )}
          {hi != null && (
            <g>
              <line className="crosshair" x1={x(years[hi])} x2={x(years[hi])} y1={m.t} y2={h - m.b} />
              {state[hi] != null && <circle className="hi-dot violet" cx={x(years[hi])} cy={y(state[hi]!)} r={4.5} />}
              {county?.[hi] != null && <circle className="hi-dot teal" cx={x(years[hi])} cy={y(county[hi]!)} r={4.5} />}
              <g
                className="tip-svg"
                transform={`translate(${x(years[hi]) > width / 2 ? x(years[hi]) - 150 : x(years[hi]) + 10},${m.t})`}
              >
                <rect width={140} height={county ? 46 : 32} rx={6} />
                <text x={8} y={14}>
                  ACS {years[hi] - 4}–{years[hi]}
                </text>
                <text x={8} y={28} className="strong">
                  {usd(state[hi])}
                </text>
                {county && (
                  <text x={8} y={41} className="teal">
                    {usd(county[hi])}
                  </text>
                )}
              </g>
            </g>
          )}
        </svg>
      )}
      <p className="footnote">Three non-overlapping 5-year releases, each in its own (nominal) dollars, so part of the rise is inflation.</p>
    </div>
  );
}
