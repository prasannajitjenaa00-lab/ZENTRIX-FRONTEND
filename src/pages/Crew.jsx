import { tasksApi, usersApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useNav } from '../contexts/NavContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { useRoster } from '../hooks/useRoster';
import Avatar from '../components/Avatar';
import KpiCard from '../components/KpiCard';
import TaskTable from '../components/TaskTable';
import { Page, Resource } from '../components/Page';
import { useOpenAssignTo, useOpenTask } from '../modals/TaskModal';
import { avgProgress, byDue, fmtDate, isOverdue, roleLabel, statusCounts } from '../utils/format';
import { useState } from 'react';

function groupEmployeesByLeader(people, roster) {
  const employees = people.filter((p) => p.role === 'employee'); const others = people.filter((p) => p.role !== 'employee');
  const buckets = new Map(); employees.forEach((p) => { const key = p.leaderId || '_none'; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(p); });
  const groups = [];
  roster.list.filter((u) => u.role === 'team_leader').sort((a, b) => a.name.localeCompare(b.name)).forEach((leader) => {
    const members = buckets.get(leader.id); if (members?.length) { groups.push({ leader, members: members.sort((a, b) => a.name.localeCompare(b.name)) }); buckets.delete(leader.id); }
  });
  buckets.forEach((members, key) => groups.push({ leader: key === '_none' ? null : roster.map.get(key), members: members.sort((a, b) => a.name.localeCompare(b.name)) }));
  return { others, groups };
}

export function CrewView() {
  const { user } = useAuth(); const nav = useNav(); const roster = useRoster(); const openTask = useOpenTask(); const openAssignTo = useOpenAssignTo();
  useHeader('Active crew', 'Every live employee, their open book, and the percentage they last saved');
  const crew = useResource(() => usersApi.crew(), [user.id]);
  const tasks = useResource(async () => (await tasksApi.list()).data, [user.id]);
  const [pick, setPick] = useState('');
  const focus = nav.person || '';
  return (
    <Resource res={crew}>{(people) => {
      const all = tasks.data || [];
      const mineOf = (id) => all.filter((t) => t.assigneeId === id);
      const card = (p) => {
        const mine = mineOf(p.id); const pct = avgProgress(mine); const late = mine.filter(isOverdue).length;
        return (
          <article className={`crew-card ${focus === p.id ? 'on' : ''}`} key={p.id} data-person={p.id} onClick={() => nav.patch({ person: focus === p.id ? '' : p.id })}>
            <div className="crew-top"><Avatar name={p.name} /><div><strong>{p.name}</strong>
              <div className="muted">{roleLabel(p.role)}</div></div><span className="badge st-Completed">{pct}%</span></div>
            <div className="progress-bar tall"><span style={{ width: `${pct}%` }} /></div>
            <div className="crew-stats"><span>{mine.length} assigned</span><span>{mine.filter((t) => t.status !== 'Completed').length} open</span><span>{mine.filter((t) => t.status === 'Completed').length} done</span><span className={late ? 'late' : ''}>{late} overdue</span></div>
            <div className="crew-actions"><button type="button" className="btn btn-primary btn-sm assign-to" onClick={(e) => { e.stopPropagation(); openAssignTo(p); }}>Assign task</button></div>
          </article>);
      };
      const { others, groups } = groupEmployeesByLeader(people, roster);
      const focusPerson = focus ? roster.map.get(focus) || people.find((p) => p.id === focus) : null;
      const book = (focus ? mineOf(focus) : all).slice().sort(byDue);
      const bookPick = pick || people[0]?.id || '';
      return (
        <Page>
          <div className="toolbar"><button className="btn btn-ghost btn-sm" onClick={() => nav.go('dashboard')}>← Command center</button><span className="hint-inline">{people.length} active employee{people.length === 1 ? '' : 's'}</span></div>
          {groups.map(({ leader, members }) => (
            <div className="team-block" key={leader?.id || 'none'}>
              <div className="team-heading"><div><span className="team-kicker">Team</span><strong>{leader?.name || 'Studio Crew'}</strong></div>
                <span className="team-count">{members.length} employee{members.length === 1 ? '' : 's'}</span></div>
              <div className="crew-grid">{members.map(card)}</div>
            </div>))}
          {others.length > 0 && (
            <div className="team-block"><div className="team-heading"><div><span className="team-kicker">Leadership</span><strong>Floor managers &amp; team leaders</strong></div><span className="team-count">{others.length}</span></div><div className="crew-grid">{others.map(card)}</div></div>)}
          {!groups.length && !others.length && <div className="empty">No active employees.</div>}
          <section className="panel assignment-book" style={{ marginTop: 14 }}>
            <h3><span>{focusPerson ? `${focusPerson.name} — assignment book` : 'Studio assignment book'}</span>
              <span className="book-assign">
                {focusPerson ? <button type="button" className="btn btn-lime btn-sm" onClick={() => openAssignTo(focusPerson)}>Assign task to {focusPerson.name.split(' ')[0]}</button> : (
                  <><select id="book-assignee" value={bookPick} onChange={(e) => setPick(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.department}</option>)}</select>
                    <button type="button" className="btn btn-lime btn-sm" id="book-assign-btn" onClick={() => { const p = people.find((x) => x.id === bookPick); if (!p) return; nav.patch({ person: p.id }); openAssignTo(p); }}>Assign task</button></>)}
              </span></h3>
            <TaskTable tasks={book} ownerName={roster.name} onOpen={openTask} />
          </section>
        </Page>);
    }}</Resource>
  );
}

/** open / completed / overdue boards (the original's openWorkView, completedView, overdueView). */
export function BoardView({ kind }) {
  const { user } = useAuth(); const nav = useNav(); const roster = useRoster(); const openTask = useOpenTask();
  const titles = { open: ['Open work', 'Everything still moving — pending, in progress, and on hold'], completed: ['Completed work', 'Closed assignments and the percentage saved by each owner'], overdue: ['Overdue', 'Past due and still not completed — nudge the owner from here'] };
  useHeader(...titles[kind]);
  const res = useResource(async () => (await tasksApi.list()).data, [user.id]);
  return (
    <Resource res={res}>{(all) => {
      let list; let kpis;
      if (kind === 'open') {
        list = all.filter((t) => t.status !== 'Completed').sort(byDue); const c = statusCounts(list);
        kpis = [['Open', list.length, `${avgProgress(list)}% average progress`, '#ff8a2b'], ['Pending', c.Pending, 'Not started', '#12c2d4'], ['In progress', c['In Progress'], 'Actively shipping', '#ff8a2b'], ['On hold', c['On Hold'], 'Waiting on a signal', '#8b7cff']];
      } else if (kind === 'completed') {
        list = all.filter((t) => t.status === 'Completed').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        kpis = [['Closed', list.length, 'Marked completed', '#2ec27a'], ['Studio rate', `${all.length ? Math.round((list.length / all.length) * 100) : 0}%`, 'Completed vs assigned', '#12c2d4'], ['Avg close %', `${avgProgress(list)}%`, 'Should read 100 after a close', '#c6ef3a'], ['Owners', new Set(list.map((t) => t.assigneeId)).size, 'People who shipped', '#2b5de8']];
      } else {
        list = all.filter(isOverdue).sort(byDue);
        kpis = [['Overdue', list.length, 'Need a status nudge', '#ff5a32'], ['Avg stuck %', `${avgProgress(list)}%`, 'Progress last saved by employee', '#ff8a2b'], ['Owners', new Set(list.map((t) => t.assigneeId)).size, 'People carrying slip', '#8b7cff'], ['Oldest due', list[0] ? fmtDate(list[0].due) : '—', list[0] ? list[0].title : 'Clear board', '#12c2d4']];
      }
      return (
        <Page>
          <div className="toolbar"><button className="btn btn-ghost btn-sm" onClick={() => nav.go('dashboard')}>← Command center</button></div>
          <div className="kpi-grid">{kpis.map(([l, v, s, a]) => <KpiCard key={l} label={l} value={v} sub={s} accent={a} />)}</div>
          <section className="panel"><TaskTable tasks={list} ownerName={roster.name} onOpen={openTask} /></section>
        </Page>);
    }}</Resource>
  );
}
