import { useEffect, useRef } from 'react';

/** KPI card; numeric values count up over 700 ms exactly like the original. */
export default function KpiCard({ label, value, sub, accent, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; const raw = String(value ?? '').trim(); const num = parseFloat(raw);
    if (!el || Number.isNaN(num) || !/^-?\d/.test(raw)) { if (el) el.textContent = raw; return undefined; }
    const suffix = raw.replace(/^-?\d+(\.\d+)?/, ''); const start = performance.now(); let raf;
    const tick = (now) => { const t = Math.min(1, (now - start) / 700); el.textContent = Math.round(num * (1 - (1 - t) ** 3)) + suffix; if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <article className={`kpi ${onClick ? 'kpi-link' : ''}`} style={{ '--accent': accent }} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="k-label">{label}</div>
      <div className="k-val" ref={ref}>{String(value ?? '')}</div>
      <div className="k-sub">{sub}</div>
      {onClick && <div className="k-go">Open details →</div>}
    </article>
  );
}
