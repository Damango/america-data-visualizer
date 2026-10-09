import { OUTLINE } from "./lib/outline";

/**
 * Placeholder drawn in exactly the spot the map will occupy, from a small outline bundled with the app,
 * so nothing moves when the real boundaries arrive.
 */
export function MapSkeleton({
  width,
  height,
  focus,
  leaving,
}: {
  width: number;
  height: number;
  focus: { x: number; y: number; w: number; h: number };
  leaving: boolean;
}) {
  if (!width || !height) return null;
  const pad = width < 700 ? 12 : 24;
  return (
    <svg className={`map-skeleton ${leaving ? "is-leaving" : ""}`} width={width} height={height} aria-hidden>
      <defs>
        <linearGradient id="skel-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={OUTLINE.width} y2="0">
          <stop offset="0" stopColor="#151830" />
          <stop offset="0.42" stopColor="#151830" />
          <stop offset="0.5" stopColor="#262a4d" />
          <stop offset="0.58" stopColor="#151830" />
          <stop offset="1" stopColor="#151830" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from={-OUTLINE.width}
            to={OUTLINE.width}
            dur="1.6s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      <svg
        x={focus.x + pad}
        y={focus.y + pad}
        width={Math.max(0, focus.w - 2 * pad)}
        height={Math.max(0, focus.h - 2 * pad)}
        viewBox={`0 0 ${OUTLINE.width} ${OUTLINE.height}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
      >
        <path d={OUTLINE.nation} fill="url(#skel-shine)" />
        <path d={OUTLINE.borders} className="skel-borders" />
        <path d={OUTLINE.nation} className="skel-edge" />
      </svg>
    </svg>
  );
}

/** A panel-shaped placeholder; `rows` are relative line widths. */
export function PanelSkeleton({ height, rows = [0.9, 0.7, 0.8] }: { height: number; rows?: number[] }) {
  return (
    <div className="panel panel-skeleton" style={{ height }} aria-hidden>
      <span className="skel-line skel-title" />
      <span className="skel-line skel-sub" />
      {rows.map((w, i) => (
        <span key={i} className="skel-line" style={{ width: `${w * 100}%` }} />
      ))}
    </div>
  );
}
