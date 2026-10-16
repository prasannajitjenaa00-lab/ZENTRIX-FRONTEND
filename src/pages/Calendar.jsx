import { tasksApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import { Page, Resource } from '../components/Page';
import { useOpenTask } from '../modals/TaskModal';
import { localISO, todayISO, ym } from '../utils/format';

export default function Calendar() {
  const { user } = useAuth(); const nav = useNav(); const roster = useRoster(); const openTask = useOpenTask();
  const admin = user.role === 'admin';
  useHeader(admin ? 'Monthly orbit' : 'My calendar', 'September-first planning board for Zentrix');
  const { year: y, month: m } = nav; const filterId = nav.calUser || (admin ? 'all' : user.id);
  const res = useResource(() => tasksApi.calendar(ym(y, m), admin ? filterId : undefined), [y, m, filterId, user.id]);

  const first = new Date(y, m, 1); const startDow = first.getDay(); const daysIn = new Date(y, m + 1, 0).getDate();
  const monthName = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const move = (delta) => { let nm = m + delta; let ny = y; if (nm < 0) { nm = 11; ny -= 1; } if (nm > 11) { nm = 0; ny += 1; } nav.patch({ month: nm, year: ny }); };
  const employees = roster.list.filter((x) => x.role === 'employee');

  return (
    <Resource res={res}>{(tasks) => {
      const cells = [];
      for (let i = 0; i < startDow; i++) cells.push({ date: new Date(y, m, -startDow + i + 1), out: true, items: [] });
      for (let d = 1; d <= daysIn; d++) { const date = new Date(y, m, d); const iso = localISO(date); cells.push({ date, out: false, items: tasks.filter((t) => t.due === iso) }); }
      while (cells.length % 7) { const n = cells.length - startDow - daysIn + 1; cells.push({ date: new Date(y, m + 1, n), out: true, items: [] }); }
      const today = todayISO();
      return (
        <Page>
          <div className="cal-head">
            <div className="cal-nav"><button className="btn btn-ghost btn-sm" id="prev-m" onClick={() => move(-1)}>←</button><div className="month-title">{monthName}</div><button className="btn btn-ghost btn-sm" id="next-m" onClick={() => move(1)}>→</button></div>
            <div className="toolbar" style={{ margin: 0 }}>
              {admin && (<select id="cal-user" className="filters" value={filterId} onChange={(e) => nav.patch({ calUser: e.target.value })}><option value="all">Entire studio</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>)}
              {admin && <button className="btn btn-lime btn-sm" id="quick-assign" onClick={() => openTask()}>Assign on this month</button>}
            </div>
          </div>
          <div className="cal-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div className="cal-dow" key={d}>{d}</div>)}
            {cells.map((c) => {
              const iso = localISO(c.date); const shown = c.items.slice(0, 3); const extra = c.items.length - shown.length;
              return (
                <div key={iso + (c.out ? 'o' : '')} className={`day ${c.out ? 'out' : ''} ${iso === today ? 'today' : ''}`} data-date={iso}>
                  <div className="day-num">{c.date.getDate()}</div>
                  {shown.map((t) => <div key={t.id} className={`chip ${t.status}`} title={t.title} onClick={() => openTask(t)}>{t.title}</div>)}
                  {extra > 0 && <div className="more">+{extra} more</div>}
                </div>);
            })}
          </div>
        </Page>);
    }}</Resource>
  );
}
