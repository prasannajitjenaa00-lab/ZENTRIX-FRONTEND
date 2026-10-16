import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STATUS, STATUS_COLOR, avgProgress, fmtDate, isOverdue } from '../utils/format';

function pieSlices(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;
  return STATUS.map((st) => { const slice = (counts[st] || 0) / total; const start = angle; const end = angle + slice * Math.PI * 2; angle = end; return { st, start, end, count: counts[st] || 0 }; });
}
function drawPie(canvas, counts, highlight) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const cx = canvas.width / 2; const cy = canvas.height / 2; const r = Math.min(cx, cy) - 8; const inner = r * 0.58;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieSlices(counts).forEach((s) => {
    if (!s.count && totalCount) return;
    ctx.beginPath(); const grow = highlight === s.st ? 6 : 0;
    ctx.arc(cx, cy, r + grow, s.start, s.end); ctx.arc(cx, cy, inner - grow * 0.3, s.end, s.start, true); ctx.closePath();
    ctx.fillStyle = STATUS_COLOR[s.st]; ctx.globalAlpha = highlight && highlight !== s.st ? 0.38 : 1; ctx.fill(); ctx.globalAlpha = 1;
  });
  ctx.fillStyle = '#e8f1fb'; ctx.font = '700 22px Plus Jakarta Sans, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(totalCount), cx, cy - 8);
  ctx.fillStyle = '#8aa3bf'; ctx.font = '600 11px Plus Jakarta Sans, sans-serif'; ctx.fillText('TASKS', cx, cy + 12);
}

function PeopleBreakdown({ tasks, nameOf }) {
  const map = new Map();
  tasks.forEach((t) => { const id = t.assigneeId || 'none'; if (!map.has(id)) map.set(id, []); map.get(id).push(t); });
  return [...map.entries()].map(([id, list]) => {
    const late = list.filter(isOverdue).length;
    return (
      <div className="tip-person" key={id}>
        <strong>{nameOf(id) || 'Unassigned'}</strong> <span>{list.length} task{list.length === 1 ? '' : 's'}{late ? ` · ${late} overdue` : ''}</span>
        <ul>{list.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4).map((t) => <li key={t.id}>{t.title} <em>{fmtDate(t.due)}{isOverdue(t) ? ' · overdue' : ''} · {t.progress || 0}%</em></li>)}</ul>
      </div>
    );
  });
}

/** Canvas status ring + legend + hover tooltip + click-through (port of drawPie/bindStatusRing/ringTooltipHTML). */
export default function StatusRing({ tasks, counts, nameOf = () => null, onNavigate }) {
  const canvasRef = useRef(null); const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);       // { key, left, top }
  const slices = useMemo(() => pieSlices(counts), [counts]);

  useEffect(() => { if (canvasRef.current) drawPie(canvasRef.current, counts, tip && tip.key !== 'center' ? tip.key : null); }, [counts, tip]);

  const hit = useCallback((ev) => {
    const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width); const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const cx = canvas.width / 2; const cy = canvas.height / 2; const dx = x - cx; const dy = y - cy; const dist = Math.sqrt(dx * dx + dy * dy);
    const r = Math.min(cx, cy) - 8; const inner = r * 0.58;
    if (dist < inner * 0.72) return 'center';
    if (dist < inner - 4 || dist > r + 8) return null;
    let ang = Math.atan2(dy, dx); if (ang < -Math.PI / 2) ang += Math.PI * 2;
    const found = slices.find((s) => ang >= s.start && ang <= s.end);
    return found ? found.st : slices[slices.length - 1]?.st;
  }, [slices]);

  const show = (key, ev) => {
    const w = wrapRef.current.getBoundingClientRect();
    setTip({ key, left: Math.min(ev.clientX - w.left + 14, w.width - 280), top: Math.min(ev.clientY - w.top + 14, w.height - 40) });
  };
  const goFor = (key) => { if (key === 'Completed') onNavigate?.('completed'); else if (key === 'center') onNavigate?.('tasks'); else onNavigate?.('open'); };
  const late = tasks.filter(isOverdue);

  let tipBody = null;
  if (tip?.key === 'center') {
    tipBody = (<><div className="tip-h">Studio snapshot</div><div className="tip-meta">{tasks.length} tasks · {avgProgress(tasks)}% avg progress · {late.length} overdue</div>
      {STATUS.map((st) => <div className="tip-row" key={st}><i style={{ background: STATUS_COLOR[st] }} />{st} · {counts[st] || 0}</div>)}
      {late.length > 0 && <><div className="tip-h" style={{ marginTop: 8 }}>Overdue owners</div><PeopleBreakdown tasks={late} nameOf={nameOf} /></>}</>);
  } else if (tip) {
    const list = tasks.filter((t) => t.status === tip.key); const l = list.filter(isOverdue);
    tipBody = (<><div className="tip-h">{tip.key} · {list.length}</div><div className="tip-meta">{avgProgress(list)}% avg progress{l.length ? ` · ${l.length} overdue` : ''}</div>
      {list.length ? <PeopleBreakdown tasks={list} nameOf={nameOf} /> : <div className="tip-empty">Nobody in this slice.</div>}</>);
  }

  return (
    <div className="chart-wrap ring-host" ref={wrapRef} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} id="pie" width="240" height="240" aria-label="Work status ring"
        onMouseMove={(e) => { const k = hit(e); if (!k) setTip(null); else show(k, e); }} onMouseLeave={() => setTip(null)} onClick={(e) => { const k = hit(e); if (k) goFor(k); }} />
      <div className="legend">
        {STATUS.map((st) => (
          <div key={st} className={`leg-item ${tip?.key === st ? 'on' : ''}`} data-st={st} onMouseEnter={(e) => show(st, e)} onMouseLeave={() => setTip(null)} onClick={() => goFor(st)}>
            <i style={{ background: STATUS_COLOR[st] }} />{st} · {counts[st]}
          </div>
        ))}
      </div>
      {tip && <div className="ring-tip" style={{ left: tip.left, top: tip.top }}>{tipBody}</div>}
    </div>
  );
}
