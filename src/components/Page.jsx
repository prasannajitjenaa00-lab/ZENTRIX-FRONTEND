import { useRef } from 'react';
import { usePageAnimation } from '../hooks/usePageAnimation';

export function Page({ ready = true, children }) {
  const ref = useRef(null);
  usePageAnimation(ref, ready);
  return <div ref={ref} className="page-enter">{children}</div>;
}

export const Loading = () => (
  <div
    className="empty"
    style={{
      minHeight: 260,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        border: '3px solid rgba(0, 210, 255, 0.15)',
        borderTopColor: '#00d2ff',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }}
    />
    <div style={{ fontSize: 13, color: 'var(--soft)', letterSpacing: 0.5 }}>Loading...</div>
  </div>
);

export const ErrorBox = ({ error }) => (
  <div className="empty" role="alert" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {error?.message || 'Something went wrong.'}
  </div>
);

/** Guard for a resource: shows loading/error/empty states, then renders children(data). */
export function Resource({ res, children }) {
  if (res.error && res.data == null) return <ErrorBox error={res.error} />;
  if (res.data == null) return <Loading />;
  return children(res.data);
}
