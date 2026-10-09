import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { USMap, type HoverTarget } from "./USMap";
import { loadAtlas, stateNames, type Atlas } from "./lib/atlas";
import { MapSkeleton, PanelSkeleton } from "./Skeleton";
import { loadAll } from "./lib/data";
import { makeScale } from "./lib/color";
import { compact, shortCounty, usd } from "./lib/format";
import { METRICS, type County, type MetricKey, type StateData } from "./lib/types";
import { useSize, useWindowSize } from "./lib/useSize";
import { Panel } from "./charts/Panel";
import { Snapshot } from "./charts/Snapshot";
import { Distribution } from "./charts/Distribution";
import { Trend } from "./charts/Trend";
import { Beeswarm } from "./charts/Beeswarm";
import { Scatter } from "./charts/Scatter";
import { Extremes } from "./charts/Extremes";
import { StateRank } from "./charts/StateRank";
import { CountyTable } from "./charts/CountyTable";

const growthOf = (series: (number | null)[] | undefined) => {
  const a = series?.[0];
  const b = series?.[series.length - 1];
  return a && b ? b / a - 1 : null;
};

const sameTarget = (a: HoverTarget, b: HoverTarget) => a?.fips === b?.fips && a?.stateFips === b?.stateFips;

export default function App() {
  const [data, setData] = useState<Record<string, StateData> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [hover, setHover] = useState<HoverTarget>(null);
  const [chartHover, setChartHover] = useState<string | null>(null);
  const [rankHover, setRankHover] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey>("medianHH");
  const [bubbles, setBubbles] = useState(false);
  const [table, setTable] = useState(false);
  const [ref, { width }] = useSize<HTMLDivElement>();
  const { width: winW, height } = useWindowSize();

  useEffect(() => {
    // Boundaries and income data download in parallel; the skeleton holds the layout until both are in.
    loadAll().then(setData);
    loadAtlas().then(setAtlas);
  }, []);
  const STATE_NAMES = useMemo(() => (atlas ? stateNames(atlas) : {}), [atlas]);

  const states = useMemo(() => Object.values(data ?? {}), [data]);
  const countyById = useMemo(() => {
    const m: Record<string, County> = {};
    for (const s of states) for (const c of s.counties) m[c.fips] = c;
    return m;
  }, [states]);

  const byFips = useMemo(() => Object.fromEntries(states.map((s) => [s.fips, s])), [states]);

  // One color scale for states and counties alike, so a state's color is what its average would be on the county map.
  const scale = useMemo(() => {
    const counties = states.flatMap((s) => s.counties.map((c) => c[metric]).filter((v): v is number => v != null));
    const statewide = states.map((s) => s.state[metric]).filter((v): v is number => v != null);
    return makeScale(counties.length > 500 ? counties : [...counties, ...statewide]);
  }, [states, metric]);

  // The map reacts to a click at once; the side panels follow a moment later so the zoom starts without a hitch.
  const panelSelected = useDeferredValue(selected);
  const sel = panelSelected ? data?.[panelSelected] ?? null : null;
  const mapSel = selected ? data?.[selected] ?? null : null;
  const focusFips = pinned ?? chartHover ?? hover?.fips ?? null;
  const focusCounty = focusFips && sel && focusFips.startsWith(sel.fips) ? countyById[focusFips] : null;
  const pinnedCounty = pinned ? countyById[pinned] : null;

  const selectState = useCallback((abbr: string | null) => {
    setSelected(abbr);
    setPinned(null);
    setChartHover(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (table) setTable(false);
      else if (pinned) setPinned(null);
      else selectState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, table, selectState]);

  // Decided from the window, which is known before the first paint, so the first frame already has the right layout.
  const desktop = winW >= 1100;
  const colW = desktop ? Math.round(Math.min(400, Math.max(330, width * 0.25))) : 0;
  const mapH = desktop ? height : Math.round(Math.min(height * 0.62, width * 0.8 + 90));
  const focus = useMemo(
    () =>
      desktop
        ? { x: colW + 36, y: 96, w: Math.max(200, width - 2 * (colW + 36)), h: Math.max(200, height - 96 - 72) }
        : { x: 0, y: width < 720 ? 150 : 96, w: width, h: Math.max(160, mapH - (width < 720 ? 160 : 110)) },
    [desktop, colW, width, height, mapH],
  );

  // The tooltip follows the pointer by moving its element directly; React only re-renders when the hovered shape changes.
  const tipRef = useRef<HTMLDivElement>(null);
  const tipPos = useRef({ x: 0, y: 0 });
  const placeTip = (el: HTMLElement | null, w: number) => {
    if (!el) return;
    const { x, y } = tipPos.current;
    el.style.transform = `translate3d(${Math.min(x + 16, w - 230)}px, ${Math.max(8, y - 12)}px, 0)`;
  };
  const widthRef = useRef(width);
  widthRef.current = width;
  const onMapHover = useCallback((t: HoverTarget, x: number, y: number) => {
    tipPos.current = { x, y };
    placeTip(tipRef.current, widthRef.current);
    setHover((prev) => (sameTarget(prev, t) ? prev : t));
  }, []);

  const hoverCounty = hover?.fips ? countyById[hover.fips] : null;
  const hoverStateData = hover?.stateFips ? byFips[hover.stateFips] ?? null : null;
  const hoverEmpty = hover?.stateFips && !hoverStateData ? STATE_NAMES[hover.stateFips] : null;
  const tipArea = hoverCounty ?? (hoverStateData && hoverStateData.abbr !== selected ? hoverStateData.state : null);
  const ready = !!(data && atlas && width > 0);
  // Keep the map skeleton a little longer so it fades out underneath the map's own draw-in.
  const [skeletonGone, setSkeletonGone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSkeletonGone(true), 1400);
    return () => clearTimeout(t);
  }, [ready]);
  const vintage = states[0]?.source;
  const allCounties = useMemo(() => states.flatMap((s) => s.counties), [states]);
  const countyTotal = allCounties.length;

  const pinCounty = useCallback((f: string | null) => setPinned(f), []);
  const pinToggle = useCallback((f: string) => setPinned((p) => (p === f ? null : f)), []);

  return (
    <div className={`app ${desktop ? "is-desktop" : "is-mobile"}`}>
      <div className="backdrop" aria-hidden />
      <div className="map-stage" ref={ref} style={desktop ? undefined : { height: mapH }}>
        {!skeletonGone && <MapSkeleton width={width} height={desktop ? height : mapH} focus={focus} leaving={ready} />}
        {ready && (
          <USMap
            atlas={atlas}
            width={width}
            height={desktop ? height : mapH}
            focus={focus}
            data={data!}
            metric={metric}
            scale={scale}
            selected={selected}
            hovered={hover?.fips ?? chartHover}
            hoveredState={rankHover}
            pinned={pinned}
            showBubbles={bubbles}
            onSelectState={selectState}
            onPinCounty={pinCounty}
            onHover={onMapHover}
          />
        )}
        {hover && (tipArea || hoverEmpty) && (
          <div className="tooltip" ref={(el) => ((tipRef.current = el), placeTip(el, width))}>
            {tipArea ? (
              <>
                <strong>{tipArea.name}</strong>
                <span className="tip-big">{usd(tipArea[metric])}</span>
                <span className="tip-sub">{METRICS[metric].label}{hoverCounty ? "" : ", statewide"}</span>
                <span className="tip-row">
                  {metric === "perCapita" ? "Median household" : "Per capita"} <b>{usd(metric === "perCapita" ? tipArea.medianHH : tipArea.perCapita)}</b>
                </span>
                <span className="tip-row">
                  Gini <b>{tipArea.gini?.toFixed(3) ?? "—"}</b> · Pop <b>{compact(tipArea.population)}</b>
                </span>
                {!hoverCounty && hoverStateData && (
                  <span className="tip-hint">{hoverStateData.counties.length ? "Click to zoom in on its counties" : "Click for statewide details"}</span>
                )}
              </>
            ) : (
              <>
                <strong>{hoverEmpty}</strong>
                <span className="tip-sub">Awaiting data</span>
              </>
            )}
          </div>
        )}
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <div>
            <h1>Income Atlas</h1>
            <nav className="crumbs" aria-label="Location">
              <button className={!selected ? "is-current" : ""} onClick={() => selectState(null)}>
                United States
              </button>
              {mapSel && (
                <>
                  <span>/</span>
                  <button className={!pinnedCounty ? "is-current" : ""} onClick={() => setPinned(null)}>
                    {mapSel.name}
                  </button>
                </>
              )}
              {pinnedCounty && (
                <>
                  <span>/</span>
                  <span className="is-current">{shortCounty(pinnedCounty.name)}</span>
                </>
              )}
            </nav>
          </div>
        </div>
        <div className="controls">
          <div className="seg" role="radiogroup" aria-label="Income measure">
            {(Object.keys(METRICS) as MetricKey[]).map((k) => (
              <button key={k} role="radio" aria-checked={metric === k} className={metric === k ? "is-on" : ""} onClick={() => setMetric(k)}>
                {METRICS[k].short}
              </button>
            ))}
          </div>
          <button className={`chip ${bubbles ? "is-on" : ""}`} onClick={() => setBubbles((b) => !b)} aria-pressed={bubbles}>
            <i className="chip-dot" /> Population
          </button>
          {mapSel && (
            <button className="chip" onClick={() => setTable(true)}>
              Table
            </button>
          )}
        </div>
      </header>

      {data && !states.length && (
        <div className="empty-banner">
          <strong>No data loaded yet.</strong> Run <code>bun run fetch-data</code> to pull county income from the Census API.
        </div>
      )}

      {!ready && (
        <>
          <aside className="col col-left" style={desktop ? { width: colW } : undefined}>
            <PanelSkeleton height={500} rows={[1, 0.95, 0.9, 0.86, 0.8, 0.76, 0.7, 0.66, 0.6, 0.55]} />
            <PanelSkeleton height={166} rows={[0.8, 0.7, 0.75]} />
          </aside>
          <aside className="col col-right" style={desktop ? { width: colW } : undefined}>
            <PanelSkeleton height={188} rows={[0.9, 0.6]} />
            <PanelSkeleton height={188} rows={[0.9, 0.6]} />
            <PanelSkeleton height={180} rows={[1, 0.95, 0.9, 0.6]} />
          </aside>
        </>
      )}

      {ready && states.length > 0 && (
        <>
          <aside className="col col-left" style={desktop ? { width: colW } : undefined} key={`l-${panelSelected}`}>
            {sel ? (
              <>
                <Panel
                  title={pinnedCounty ? pinnedCounty.name : sel.name}
                  subtitle={
                    pinnedCounty
                      ? `${sel.name} · click the county again to return`
                      : sel.counties.length
                        ? `${sel.counties.length} ${sel.counties.length === 1 ? "county" : "counties"}`
                        : "Statewide figures"
                  }
                  delay={500}
                  right={
                    pinnedCounty && (
                      <button className="icon-btn" onClick={() => setPinned(null)} aria-label="Back to state">
                        ✕
                      </button>
                    )
                  }
                >
                  <Snapshot
                    key={pinned ?? sel.abbr}
                    area={pinnedCounty ?? sel.state}
                    label={pinnedCounty ? "county" : "statewide"}
                    growth={growthOf(pinned ? sel.trend.counties[pinned] : sel.trend.state)}
                    delay={650}
                  />
                </Panel>
                <Panel title="How households earn" subtitle="Share of households by income bracket" delay={620}>
                  <Distribution state={sel.state} county={focusCounty} stateName={sel.name} />
                </Panel>
                <Panel title="Income vs. inequality" subtitle="Every county in the state" delay={740}>
                  {sel.counties.length > 1 ? (
                    <Scatter counties={sel.counties} metric={metric} scale={scale} focus={focusFips} onHover={setChartHover} onPin={pinToggle} />
                  ) : (
                    <NoCounties sel={sel} />
                  )}
                </Panel>
              </>
            ) : (
              <>
                <Panel title="Every state, ranked" subtitle={METRICS[metric].label + ", statewide"} delay={1300}>
                  <StateRank
                    states={states}
                    metric={metric}
                    scale={scale}
                    focus={rankHover ?? hover?.stateFips ?? null}
                    onSelect={selectState}
                    onHover={setRankHover}
                  />
                </Panel>
                <Panel title="How to explore" delay={1450} className="tips">
                  <ul>
                    <li>Click any state to fly in. States marked with a dot in the ranking show every county.</li>
                    <li>Hover a county for its numbers; click to pin it.</li>
                    <li>Switch the income measure at the top.</li>
                    <li>Press Esc to step back out.</li>
                  </ul>
                </Panel>
              </>
            )}
          </aside>

          <aside className="col col-right" style={desktop ? { width: colW } : undefined} key={`r-${panelSelected}`}>
            {sel ? (
              <>
                <Panel title="A decade of income" subtitle="Median household income by 5-year release" delay={560}>
                  <Trend data={sel} countyFips={focusCounty?.fips ?? null} />
                </Panel>
                <Panel title="Every county, side by side" subtitle={METRICS[metric].label} delay={680}>
                  {sel.counties.length > 1 ? <Beeswarm
                    counties={sel.counties}
                    metric={metric}
                    scale={scale}
                    stateValue={sel.state[metric]}
                    focus={focusFips}
                    onHover={setChartHover}
                    onPin={pinToggle}
                  /> : <NoCounties sel={sel} />}
                </Panel>
                {sel.counties.length > 1 && (
                  <Panel title="Highest and lowest" subtitle={METRICS[metric].label + " by county"} delay={800}>
                    <Extremes counties={sel.counties} metric={metric} scale={scale} focusValue={focusCounty?.[metric] ?? null} onPin={pinToggle} />
                  </Panel>
                )}
              </>
            ) : (
              <>
                <Panel title="Highest and lowest" subtitle="Statewide, 50 states and DC" delay={1380}>
                  <Extremes
                    counties={states.map((s) => ({ ...s.state, fips: s.fips }))}
                    metric={metric}
                    scale={scale}
                    unit="state"
                    focusValue={(rankHover ? byFips[rankHover] : hoverStateData)?.state[metric] ?? null}
                    onPin={(f) => byFips[f] && selectState(byFips[f].abbr)}
                  />
                </Panel>
                {countyTotal > 0 && (
                  <Panel title="Richest and poorest counties" subtitle={`Across the ${countyTotal.toLocaleString()} mapped counties`} delay={1450}>
                    <Extremes
                      counties={allCounties}
                      metric={metric}
                      scale={scale}
                      focusValue={null}
                      onPin={(f) => {
                        const st = byFips[f.slice(0, 2)];
                        if (st) {
                          selectState(st.abbr);
                          setPinned(f);
                        }
                      }}
                    />
                  </Panel>
                )}
                <Panel title="About the data" delay={1520} className="about">
                  <p>
                    {vintage?.survey}, U.S. Census Bureau. Median household income (table B19013), per capita income (B19301), mean
                    household income (aggregate B19025 ÷ households B19001), income brackets (B19001), Gini index (B19083) and population
                    (B01003), read from data.census.gov.
                  </p>
                </Panel>
              </>
            )}
          </aside>
        </>
      )}

      <footer className="source">
        {vintage ? (
          <>
            Source: U.S. Census Bureau, {vintage.survey}. Dollar figures are in {vintage.vintage} inflation-adjusted dollars.
          </>
        ) : (
          "Source: U.S. Census Bureau, American Community Survey"
        )}
      </footer>

      {table && sel && <CountyTable data={sel} onClose={() => setTable(false)} onPin={(f) => { setPinned(f); setTable(false); }} />}
    </div>
  );
}

function NoCounties({ sel }: { sel: StateData }) {
  return <p className="panel-empty">County figures for {sel.name} haven't been added yet; the statewide numbers are shown.</p>;
}
