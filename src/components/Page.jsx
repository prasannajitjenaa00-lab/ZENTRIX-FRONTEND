import { useRef } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';
export function Page({ ready = true, children }) {
  const ref = useRef(null); usePageAnimation(ref, ready);
  return <div ref={ref} className="page-enter">{children}</div>;
}
export const Loading = () => <div className="empty">Loading…</div>;
export const ErrorBox = ({ error }) => <div className="empty" role="alert">{error?.message || 'Something went wrong.'}</div>;
/** Guard for a resource: shows loading/error/empty states, then renders children(data). */
export function Resource({ res, children }) {
  if (res.error && res.data == null) return <ErrorBox error={res.error} />;
  if (res.data == null) return <Loading />;
  return children(res.data);
}
