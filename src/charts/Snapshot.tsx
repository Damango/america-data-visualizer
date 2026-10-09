import type { Area } from "../lib/types";
import { compact, usd } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";

function Num({ value, fmt, delay }: { value: number | null; fmt: (v: number) => string; delay: number }) {
  const ref = useCountUp<HTMLSpanElement>(value, fmt, 1500, delay);
  return <span ref={ref}>{value == null ? "—" : fmt(0)}</span>;
}

export function Snapshot({
  area,
  label,
  growth,
  delay = 0,
}: {
  area: Area;
  label: string;
  /** Change in median household income from the earliest to the latest release (nominal). */
  growth: number | null;
  delay?: number;
}) {
  return (
    <div className="snapshot">
      <div className="hero">
        <span className="hero-label">Median household income · {label}</span>
        <span className="hero-value">
          <Num value={area.medianHH} fmt={usd} delay={delay} />
        </span>
        {area.medianHH_moe != null && <span className="hero-moe">± {usd(area.medianHH_moe)} margin of error (90%)</span>}
      </div>
      <dl className="stat-grid">
        <div>
          <dt>Per capita income</dt>
          <dd>
            <Num value={area.perCapita} fmt={usd} delay={delay + 120} />
          </dd>
        </div>
        <div>
          <dt>Mean household income</dt>
          <dd>
            <Num value={area.meanHH} fmt={usd} delay={delay + 200} />
          </dd>
        </div>
        <div>
          <dt>Inequality (Gini)</dt>
          <dd>
            <Num value={area.gini} fmt={(v) => v.toFixed(3)} delay={delay + 360} />
          </dd>
        </div>
        <div>
          <dt>Population</dt>
          <dd>
            <Num value={area.population} fmt={compact} delay={delay + 440} />
          </dd>
        </div>
        <div>
          <dt>Households</dt>
          <dd>
            <Num value={area.households} fmt={compact} delay={delay + 520} />
          </dd>
        </div>
        <div>
          <dt>Change since 2010–14</dt>
          <dd className={growth != null && growth < 0 ? "neg" : "pos"}>
            <Num value={growth} fmt={(v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`} delay={delay + 600} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
