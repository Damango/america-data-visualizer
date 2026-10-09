import { useEffect, useRef } from "react";

const ease = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Animates a number from its previous value (or 0) to `target`, writing straight to the DOM
 * so a running count doesn't re-render React on every frame.
 */
export function useCountUp<T extends HTMLElement>(target: number | null, fmt: (v: number) => string, duration = 1400, delay = 0) {
  const ref = useRef<T>(null);
  const from = useRef(0);
  const fmtRef = useRef(fmt);
  fmtRef.current = fmt;
  useEffect(() => {
    const fmt = fmtRef.current;
    const el = ref.current;
    if (!el) return;
    if (target == null) {
      el.textContent = "—";
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const a = from.current;
    el.textContent = fmt(a);
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const val = a + (target - a) * ease(t);
      from.current = val;
      if (now >= start) el.textContent = fmt(val);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return ref;
}
