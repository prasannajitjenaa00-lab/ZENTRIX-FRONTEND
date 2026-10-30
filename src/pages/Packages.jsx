import { useState } from 'react';
import { packagesApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useModal } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';

function EditPackageModal({ pkg, close, onUpdated }) {
  const toast = useToast();
  const { refresh } = useLive();
  const [name, setName] = useState(pkg.name || '');
  const [amount, setAmount] = useState(pkg.amount || '');
  const [ratePerHour, setRatePerHour] = useState(pkg.ratePerHour || '');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Please enter a package name.');
    setSaving(true);
    try {
      await packagesApi.update(pkg.id, {
        name: name.trim(),
        amount: Number(amount) || 0,
        ratePerHour: Number(ratePerHour) || 0,
      });
      toast('Package updated successfully.');
      refresh();
      onUpdated?.();
      close();
    } catch (err) {
      toast(err.message || 'Failed to update package.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, width: '100%', background: '#ffffff', borderRadius: 16, padding: '24px', color: '#0f172a' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
        Edit Package
      </h3>
      <form onSubmit={handleUpdate}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
            Package Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
            Package Price
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Price"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
            Per Hour Price
          </label>
          <input
            type="number"
            min="0"
            value={ratePerHour}
            onChange={(e) => setRatePerHour(e.target.value)}
            placeholder="Enter Per Hour Price"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#64748b', borderColor: '#cbd5e1' }}
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-sm"
            style={{ background: '#0e9384', color: '#ffffff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600 }}
            disabled={saving}
          >
            {saving ? 'Updating…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PackagesView() {
  const { user } = useAuth();
  const { open } = useModal();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('Packages', 'Configure employee packages, package prices, and hourly rates');

  const res = useResource(() => packagesApi.list(), [user.id]);

  // Form states matching user's reference image
  const [packageName, setPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [perHourPrice, setPerHourPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!packageName.trim()) {
      return toast('Please enter a package name.');
    }
    const amt = Number(packagePrice);
    if (isNaN(amt) || amt < 0) {
      return toast('Please enter a valid package price.');
    }
    const hrRate = Number(perHourPrice);
    if (isNaN(hrRate) || hrRate < 0) {
      return toast('Please enter a valid per hour price.');
    }

    setSubmitting(true);
    try {
      await packagesApi.create({
        name: packageName.trim(),
        amount: amt,
        ratePerHour: hrRate,
        currency: '₹',
        note: `Base ₹${amt} · ₹${hrRate}/hr`,
      });
      toast(`Package "${packageName.trim()}" created successfully!`);
      setPackageName('');
      setPackagePrice('');
      setPerHourPrice('');
      refresh();
      res.reload();
    } catch (err) {
      toast(err.message || 'Failed to create package.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Delete package "${pkg.name}"? Employees with this package will be reassigned.`)) return;
    try {
      await packagesApi.remove(pkg.id);
      toast('Package deleted successfully.');
      refresh();
      res.reload();
    } catch (err) {
      toast(err.message || 'Failed to delete package.');
    }
  };

  const handleEdit = (pkg) => {
    open(({ close }) => (
      <EditPackageModal
        pkg={pkg}
        close={close}
        onUpdated={() => {
          res.reload();
        }}
      />
    ));
  };

  return (
    <Resource res={res}>
      {(pkgs) => {
        const packageList = Array.isArray(pkgs) ? pkgs : [];

        return (
          <Page>
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Add Package Section (Themed to project dark glassmorphic UI) */}
              <div
                style={{
                  background: 'var(--glass-bg, rgba(15, 23, 42, 0.75))',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  padding: '28px 32px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                  color: 'var(--text, #ffffff)',
                }}
              >
                <h2
                  style={{
                    margin: '0 0 22px',
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Add Package
                </h2>

                <form onSubmit={handleSubmit}>
                  {/* 1. Package Name */}
                  <div style={{ marginBottom: 18 }}>
                    <label
                      htmlFor="pkg-name-input"
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: 'var(--muted, #94a3b8)',
                        marginBottom: 7,
                      }}
                    >
                      Package Name
                    </label>
                    <input
                      id="pkg-name-input"
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="Name"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        color: '#ffffff',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#0e9384';
                        e.target.style.boxShadow = '0 0 0 2px rgba(14, 147, 132, 0.25)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* 2. Package Price */}
                  <div style={{ marginBottom: 18 }}>
                    <label
                      htmlFor="pkg-price-input"
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: 'var(--muted, #94a3b8)',
                        marginBottom: 7,
                      }}
                    >
                      Package Price
                    </label>
                    <input
                      id="pkg-price-input"
                      type="number"
                      min="0"
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(e.target.value)}
                      placeholder="Price"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        color: '#ffffff',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#0e9384';
                        e.target.style.boxShadow = '0 0 0 2px rgba(14, 147, 132, 0.25)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* 3. Per Hour Price */}
                  <div style={{ marginBottom: 22 }}>
                    <label
                      htmlFor="pkg-per-hour-input"
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: 'var(--muted, #94a3b8)',
                        marginBottom: 7,
                      }}
                    >
                      Per Hour Price
                    </label>
                    <input
                      id="pkg-per-hour-input"
                      type="number"
                      min="0"
                      value={perHourPrice}
                      onChange={(e) => setPerHourPrice(e.target.value)}
                      placeholder="Enter Per Hour Price"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        color: '#ffffff',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#0e9384';
                        e.target.style.boxShadow = '0 0 0 2px rgba(14, 147, 132, 0.25)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: 'linear-gradient(135deg, #0e9384 0%, #10b981 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 26px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                      transition: 'opacity 0.15s ease, transform 0.1s ease',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </form>
              </div>

              {/* Existing Packages List */}
              <div
                style={{
                  background: 'var(--glass-bg, rgba(15, 23, 42, 0.75))',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  padding: '24px 28px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>All Packages</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                      Available wallet packages for employee assignment
                    </p>
                  </div>
                  <span
                    style={{
                      background: 'rgba(14, 147, 132, 0.2)',
                      color: '#14b8a6',
                      border: '1px solid rgba(14, 147, 132, 0.4)',
                      borderRadius: 12,
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {packageList.length} Active {packageList.length === 1 ? 'Package' : 'Packages'}
                  </span>
                </div>

                {!packageList.length ? (
                  <div className="empty" style={{ padding: '30px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                    <strong>No packages created yet.</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Use the "Add Package" form above to create your first employee package.
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0e9384', color: '#fff', fontSize: 12.5, fontWeight: 700 }}>
                          <th style={{ padding: '12px 16px', width: 60 }}>#</th>
                          <th style={{ padding: '12px 16px' }}>PACKAGE NAME</th>
                          <th style={{ padding: '12px 16px' }}>PACKAGE PRICE</th>
                          <th style={{ padding: '12px 16px' }}>PER HOUR PRICE</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packageList.map((p, idx) => {
                          const rate = p.ratePerHour ?? (p.amount ? Math.round(p.amount / 20) : 0);
                          return (
                            <tr
                              key={p.id}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                              }}
                            >
                              <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 13 }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <strong style={{ color: '#fff', fontSize: 14 }}>{p.name}</strong>
                                {p.note && (
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.note}</div>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#f8fafc',
                                  }}
                                >
                                  ₹ {Number(p.amount || 0).toLocaleString()}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 10px',
                                    borderRadius: 12,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#10b981',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  ₹ {rate} / hr
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(p)}
                                    style={{
                                      border: '1px solid rgba(14, 147, 132, 0.8)',
                                      color: '#14b8a6',
                                      background: 'rgba(14, 147, 132, 0.1)',
                                      borderRadius: 6,
                                      padding: '4px 12px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(p)}
                                    style={{
                                      border: '1px solid rgba(239, 68, 68, 0.5)',
                                      color: '#f87171',
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      borderRadius: 6,
                                      padding: '4px 12px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Page>
        );
      }}
    </Resource>
  );
}
export { PackagesView };

