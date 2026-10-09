import { memo, useEffect, useMemo, useRef } from "react";
import { easeCubicInOut, geoAlbersUsa, geoPath, interpolateZoom, select, type ScaleSequential } from "d3";
import "d3-transition";
import type { Atlas } from "./lib/atlas";
import type { County, MetricKey, StateData } from "./lib/types";

export type HoverTarget = { fips?: string; stateFips?: string } | null;

type Props = {
  atlas: Atlas;
  width: number;
  height: number;
  /** Area (px) the selected state should be framed in, between the side panels. */
  focus: { x: number; y: number; w: number; h: number };
  data: Record<string, StateData>;
  metric: MetricKey;
  scale: ScaleSequential<string>;
  selected: string | null;
  hovered: string | null;
  /** State FIPS to outline, e.g. while hovering the ranking list. */
  hoveredState: string | null;
  pinned: string | null;
  showBubbles: boolean;
  onSelectState: (abbr: string) => void;
  onPinCounty: (fips: string | null) => void;
  onHover: (target: HoverTarget, x: number, y: number) => void;
};

type View = [number, number, number];
type StateShape = { id: string; d: string; c: [number, number]; bounds: [number, number, number, number]; order: number };
type CountyShape = { id: string; d: string; cx: number; cy: number; dist: number };

// The two heavy layers are memoized on their own, so hovering only redraws the thin outline layer on top.
const StatesLayer = memo(function StatesLayer({
  states,
  fills,
  selectedFips,
  width,
}: {
  states: StateShape[];
  fills: Record<string, string | undefined>;
  selectedFips: string | null;
  width: number;
}) {
  return (
    <g className="states">
      {states.map((s) => {
        const fill = fills[s.id];
        const delay = 500 + (s.order / (width || 1)) * 700;
        return (
          <path
            key={s.id}
            d={s.d}
            data-state={s.id}
            pathLength={1}
            className={`state ${fill ? "is-active" : "is-empty"} ${s.id === selectedFips ? "is-selected" : ""}`}
            style={{
              fill,
              // Outline draws first, then the fill washes in behind it.
              animationDelay: `${delay}ms, ${delay + 650}ms`,
            }}
          />
        );
      })}
    </g>
  );
});

const CountiesLayer = memo(function CountiesLayer({ counties, fills }: { counties: CountyShape[]; fills: Record<string, string> }) {
  return (
    <g className="counties">
      {counties.map((c) => (
        <path
          key={c.id}
          d={c.d}
          data-fips={c.id}
          className="county"
          // Counties ripple out from the state's center as the camera arrives.
          style={{ fill: fills[c.id], animationDelay: `${520 + c.dist * 950}ms` }}
        />
      ))}
    </g>
  );
});

function USMapInner(p: Props) {
  const { atlas, width, height, focus, data, selected, metric, scale } = p;
  const zoomRef = useRef<SVGGElement>(null);
  const glowSoftRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGGElement>(null);
  const viewRef = useRef<View | null>(null);

  const fipsToAbbr = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of Object.values(data)) m[s.fips] = s.abbr;
    return m;
  }, [data]);
  const selectedFips = selected ? data[selected]?.fips ?? null : null;

  const geo = useMemo(() => {
    if (!width || !height) return null;
    const pad = width < 700 ? 12 : 24;
    const projection = geoAlbersUsa().fitExtent(
      [
        [focus.x + pad, focus.y + pad],
        [focus.x + focus.w - pad, focus.y + focus.h - pad],
      ],
      atlas.nation,
    );
    const path = geoPath(projection);
    const nationCx = focus.x + focus.w / 2;
    const states: StateShape[] = atlas.states.map((f) => {
      const [[x0, y0], [x1, y1]] = path.bounds(f);
      return { id: f.id, d: path(f) ?? "", c: path.centroid(f), bounds: [x0, y0, x1, y1], order: (x0 + x1) / 2 - nationCx };
    });
    return { path, states, nation: path(atlas.nation) ?? "", borders: path(atlas.borders) ?? "" };
  }, [atlas, width, height, focus.x, focus.y, focus.w, focus.h]);

  const countyById = useMemo(() => {
    const m: Record<string, County> = {};
    for (const s of Object.values(data)) for (const c of s.counties) m[c.fips] = c;
    return m;
  }, [data]);

  // Only the selected state's counties are projected, and only when it is opened.
  const counties = useMemo<CountyShape[]>(() => {
    if (!geo || !selectedFips) return [];
    const st = geo.states.find((s) => s.id === selectedFips);
    if (!st) return [];
    const [x0, y0, x1, y1] = st.bounds;
    const diag = Math.hypot(x1 - x0, y1 - y0);
    return atlas
      .countiesOf(selectedFips)
      .filter((f) => countyById[f.id])
      .map((f) => {
        const [cx, cy] = geo.path.centroid(f);
        return { id: f.id, d: geo.path(f) ?? "", cx, cy, dist: Math.hypot(cx - (x0 + x1) / 2, cy - (y0 + y1) / 2) / diag };
      });
  }, [atlas, geo, selectedFips, countyById]);

  const stateFills = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const s of Object.values(data)) {
      const v = s.state[metric];
      m[s.fips] = v == null ? "#2a2d3e" : scale(v);
    }
    return m;
  }, [data, metric, scale]);

  const countyFills = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of counties) {
      const v = countyById[c.id]?.[metric];
      m[c.id] = v == null ? "#2a2d3e" : scale(v);
    }
    return m;
  }, [counties, countyById, metric, scale]);

  // Target view for the zoom group: [cx, cy, visible width] centered on the focus box.
  const target = useMemo<View | null>(() => {
    if (!geo) return null;
    const fx = focus.x + focus.w / 2;
    const fy = focus.y + focus.h / 2;
    const st = selectedFips && geo.states.find((s) => s.id === selectedFips);
    if (!st) return [fx, fy, focus.w];
    const [x0, y0, x1, y1] = st.bounds;
    const k = Math.min((focus.w * 0.86) / (x1 - x0), (focus.h * 0.86) / (y1 - y0));
    return [(x0 + x1) / 2, (y0 + y1) / 2, focus.w / k];
  }, [geo, selectedFips, focus.x, focus.y, focus.w, focus.h]);

  const k = target ? focus.w / target[2] : 1;

  useEffect(() => {
    const g = zoomRef.current;
    if (!g || !target) return;
    const glows = [glowSoftRef.current, glowRef.current];
    const fx = focus.x + focus.w / 2;
    const fy = focus.y + focus.h / 2;
    const toTransform = ([cx, cy, w]: View) => {
      const kk = focus.w / w;
      return `translate(${fx - cx * kk},${fy - cy * kk}) scale(${kk})`;
    };
    // The blurred glows sit out the flight and fade back in once the camera lands,
    // so their blur is computed once per view instead of on every frame.
    const placeGlows = (tr: string) => {
      for (const el of glows) el?.setAttribute("transform", tr);
    };
    const from = viewRef.current;
    viewRef.current = target;
    const sel = select(g);
    sel.interrupt();
    if (!from) {
      const tr = toTransform(target);
      sel.attr("transform", tr);
      placeGlows(tr);
      return;
    }
    const i = interpolateZoom(from, target);
    const root = document.documentElement;
    // Start on the next frame so the panels mounting in this commit don't eat the first frames of the flight.
    const raf = requestAnimationFrame(() => {
      root.classList.add("is-flying");
      sel
        .transition()
        .duration(Math.min(1800, Math.max(1050, i.duration * 0.75)))
        .ease(easeCubicInOut)
        .attrTween("transform", () => (t) => toTransform(i(t) as View))
        .on("end", () => {
          placeGlows(toTransform(target));
          root.classList.remove("is-flying");
        });
    });
    return () => cancelAnimationFrame(raf);
  }, [target, focus.x, focus.y, focus.w, focus.h]);

  if (!geo) return null;

  const pinId = p.pinned;
  const hoverPath = p.hovered ? counties.find((c) => c.id === p.hovered) : null;
  const pinPath = pinId ? counties.find((c) => c.id === pinId) : null;
  const selState = selectedFips ? geo.states.find((s) => s.id === selectedFips) : null;
  const hoverState = p.hoveredState && p.hoveredState !== selectedFips ? geo.states.find((s) => s.id === p.hoveredState) : null;

  const rMax = selected ? 30 : 26;
  const bubbleItems = selectedFips
    ? counties.map((c) => ({ id: c.id, cx: c.cx, cy: c.cy, pop: countyById[c.id]?.population ?? 0 }))
    : geo.states
        .filter((s) => fipsToAbbr[s.id])
        .map((s) => ({ id: s.id, cx: s.c[0], cy: s.c[1], pop: data[fipsToAbbr[s.id]].state.population ?? 0 }));
  const bubbles = bubbleItems.filter((b) => Number.isFinite(b.cx) && Number.isFinite(b.cy));
  const maxPop = Math.max(1, ...bubbles.map((b) => b.pop));

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    const fips = t.getAttribute("data-fips");
    const stf = t.getAttribute("data-state");
    const rect = e.currentTarget.getBoundingClientRect();
    p.onHover(fips ? { fips } : stf ? { stateFips: stf } : null, e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    const fips = t.getAttribute("data-fips");
    const stf = t.getAttribute("data-state");
    if (fips) p.onPinCounty(fips === pinId ? null : fips);
    else if (stf && fipsToAbbr[stf] && fipsToAbbr[stf] !== selected) p.onSelectState(fipsToAbbr[stf]);
  };

  return (
    <div className="map-canvas" style={{ width, height }}>
      {/* Glows live in their own layers, blurred with CSS on the GPU, and stay still while the map moves. */}
      <svg className={`map-glow is-soft ${selected ? "has-selection" : ""}`} width={width} height={height} aria-hidden>
        <g ref={glowSoftRef}>
          <path d={geo.nation} className="glow is-nation" />
        </g>
      </svg>
      <svg className="map-glow is-strong" width={width} height={height} aria-hidden>
        <g ref={glowRef}>{selState && <path key={selState.id} d={selState.d} className="glow is-selected" />}</g>
      </svg>
      <svg
        className={`map ${selected ? "has-selection" : ""}`}
        width={width}
        height={height}
        onPointerMove={handleMove}
        onPointerLeave={() => p.onHover(null, 0, 0)}
        onClick={handleClick}
        role="img"
        aria-label="Map of the United States colored by income. Click a state to zoom in and see its counties."
      >
        <g ref={zoomRef}>
          <StatesLayer states={geo.states} fills={stateFills} selectedFips={selectedFips} width={focus.w} />
          <CountiesLayer key={`c-${selectedFips ?? "none"}`} counties={counties} fills={countyFills} />

          <path className="borders" d={geo.borders} />
          {selState && <path key={`o-${selState.id}`} className="selected-outline" d={selState.d} />}

          <g className={`bubbles ${p.showBubbles ? "is-on" : ""}`} key={`b-${selectedFips ?? "none"}`} aria-hidden>
            {bubbles.map((b) => (
              <circle key={b.id} cx={b.cx} cy={b.cy} style={{ r: p.showBubbles ? (Math.sqrt(b.pop / maxPop) * rMax + 1.5) / k : 0 }} />
            ))}
          </g>

          {pinPath && <path className="pin-outline" d={pinPath.d} />}
          {hoverPath && <path className="hover-outline" d={hoverPath.d} />}
          {hoverState && <path className="hover-outline" d={hoverState.d} />}
        </g>
      </svg>
    </div>
  );
}

export const USMap = memo(USMapInner);
