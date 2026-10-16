import { useEffect } from 'react';

/** Same entrance animation the original applied (staggered .anim-in on cards/panels + KPI count-up trigger via CSS classes). */
export function usePageAnimation(ref, ready) {
  useEffect(() => {
    const root = ref.current; if (!root || !ready) return;
    root.classList.remove('page-enter'); void root.offsetWidth; root.classList.add('page-enter');
    root.querySelectorAll('.kpi, .panel, .crew-card, .team-heading, .toolbar, .cal-head').forEach((el, i) => {
      el.classList.add('anim-in'); el.style.setProperty('--delay', `${Math.min(i * 24, 280)}ms`);
    });
  }, [ref, ready]);
}
