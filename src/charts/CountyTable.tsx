import { useMemo, useState } from "react";
import type { County, StateData } from "../lib/types";
import { int, usd } from "../lib/format";

type Col = { key: keyof County; label: string; fmt: (v: never) => string };
const COLS: Col[] = [
  { key: "name", label: "County", fmt: (v: string) => v },
  { key: "medianHH", label: "Median household", fmt: usd },
  { key: "medianHH_moe", label: "± MOE", fmt: usd },
  { key: "perCapita", label: "Per capita", fmt: usd },
  { key: "meanHH", label: "Mean household", fmt: usd },
  { key: "households", label: "Households", fmt: int },
  { key: "gini", label: "Gini", fmt: (v: number | null) => (v == null ? "—" : v.toFixed(3)) },
  { key: "population", label: "Population", fmt: int },
];

export function CountyTable({ data, onClose, onPin }: { data: StateData; onClose: () => void; onPin: (f: string) => void }) {
  const [sort, setSort] = useState<{ key: keyof County; dir: 1 | -1 }>({ key: "medianHH", dir: -1 });
  const rows = useMemo(
    () =>
      [...data.counties].sort((a, b) => {
        const av = a[sort.key] as number | string | null;
        const bv = b[sort.key] as number | string | null;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      }),
    [data, sort],
  );
  return (
    <div className="modal" role="dialog" aria-label={`${data.name} county table`} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{data.name} · all counties</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (-s.dir as 1 | -1) : -1 }))}
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="state-row">
                {COLS.map((c) => (
                  <td key={c.key}>{c.key === "name" ? `${data.name} (statewide)` : c.fmt(data.state[c.key as keyof typeof data.state] as never)}</td>
                ))}
              </tr>
              {rows.map((r) => (
                <tr key={r.fips} onClick={() => onPin(r.fips)}>
                  {COLS.map((c) => (
                    <td key={c.key}>{c.fmt(r[c.key] as never)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          {data.source.survey}. Tables {data.source.tables.join(", ")}. Fetched {data.source.fetchedAt.slice(0, 10)} from {data.source.api}.
        </p>
      </div>
    </div>
  );
}
