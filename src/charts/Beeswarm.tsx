import { useMemo } from "react";
import { scaleLinear, scaleSqrt, type ScaleSequential } from "d3";
import type { County, MetricKey } from "../lib/types";
import { usdShort } from "../lib/format";
import { useSize } from "../lib/useSize";

type Node = { fips: string; v: number; r: number; x: number; y: number };

/**
 * Stacks circles on their x position: each one takes the free spot closest to the center line.
 * It is exact and takes a couple of milliseconds, where a force simulation needed hundreds of
 * milliseconds and stalled the zoom into a state.
 */
function dodge(nodes: Node[], cy: number, gap = 0.8) {
  const order = [...nodes].sort((a, b) => b.r - a.r || a.x - b.x);
  const placed: Node[] = [];
  const maxR = order[0]?.r ?? 0;
  for (const n of order) {
    const near = placed.filter((p) => Math.abs(p.x - n.x) < n.r + maxR + gap);
    const fits = (y: number) => near.every((p) => (p.x - n.x) ** 2 + (p.y - y) ** 2 >= (p.r + n.r + gap) ** 2 - 1e-6);
    let best = fits(cy) ? cy : Infinity;
    if (best === Infinity) {
      for (const p of near) {
        const d = n.r + p.r + gap;
        const dx = p.x - n.x;
        if (Math.abs(dx) >= d) continue;
        const dy = Math.sqrt(d * d - dx * dx);
        for (const y of [p.y - dy, p.y + dy]) if (Math.abs(y - cy) < Math.abs(best - cy) && fits(y)) best = y;
      }
    }
    n.y = best === Infinity ? cy : best;
    placed.push(n);
  }
}

export function Beeswarm({
  counties,
  metric,
  scale,
  stateValue,
  focus,
  onHover,
  onPin,
}: {
  counties: County[];
  metric: MetricKey;
  scale: ScaleSequential<string>;
  stateValue: number | null;
  focus: string | null;
  onHover: (fips: string | null) => void;
  onPin: (fips: string) => void;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const h = counties.length > 150 ? 170 : 140;
  const m = { l: 10, r: 10, b: 22 };

  const { nodes, x } = useMemo(() => {
    const vals = counties.map((c) => c[metric]).filter((v): v is number => v != null);
    const x = scaleLinear()
      .domain([Math.min(...vals), Math.max(...vals)])
      .nice()
      .range([m.l + 6, Math.max(m.l + 7, width - m.r - 6)]);
    const maxPop = Math.max(...counties.map((c) => c.population ?? 0));
    const r = scaleSqrt().domain([0, maxPop]).range([1.6, counties.length > 150 ? 9 : 12]);
    const nodes: Node[] = counties
      .filter((c) => c[metric] != null)
      .map((c) => ({ fips: c.fips, v: c[metric]!, r: r(c.population ?? 0), x: x(c[metric]!), y: (h - m.b) / 2 }));
    if (width > 0) dodge(nodes, (h - m.b) / 2);
    for (const n of nodes) n.y = Math.max(n.r, Math.min(h - m.b - n.r, n.y));
    return { nodes, x };
  }, [counties, metric, width, h]);

  const cy = (h - m.b) / 2;
  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={h} onPointerLeave={() => onHover(null)}>
          {x.ticks(5).map((t) => (
            <g key={t}>
              <line className="grid" x1={x(t)} x2={x(t)} y1={0} y2={h - m.b} />
              <text className="axis" x={x(t)} y={h - 6} textAnchor="middle">
                {usdShort(t)}
              </text>
            </g>
          ))}
          {stateValue != null && (
            <g className="ref-line">
              <line x1={x(stateValue)} x2={x(stateValue)} y1={0} y2={h - m.b} />
            </g>
          )}
          {nodes
            .slice()
            .sort((a, b) => b.r - a.r)
            .map((n, i) => (
              <circle
                key={n.fips}
                className={`swarm-dot ${focus === n.fips ? "is-focus" : ""}`}
                style={
                  {
                    "--fx": `${x.range()[0] + (x.range()[1] - x.range()[0]) / 2 - n.x}px`,
                    "--fy": `${cy - n.y}px`,
                    animationDelay: `${250 + (i % 60) * 12}ms`,
                    fill: scale(n.v),
                  } as React.CSSProperties
                }
                cx={n.x}
                cy={n.y}
                r={n.r}
                onPointerEnter={() => onHover(n.fips)}
                onClick={() => onPin(n.fips)}
              />
            ))}
        </svg>
      )}
      <p className="footnote">
        Each dot is a county, sized by population. Dashed line marks the statewide figure.
      </p>
    </div>
  );
}
