import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { audioApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';

// Waveform bar heights with dynamic cyan to purple styling
const WAVE_BARS = [
  18, 30, 42, 65, 48, 32, 60, 80, 95, 70, 45, 34, 52, 75, 90,
  65, 40, 58, 85, 100, 78, 50, 68, 92, 105, 82, 60, 42, 70, 88,
  98, 72, 54, 38, 62, 80, 92, 66, 48, 32, 50, 72, 85, 58, 36,
  24, 40, 56, 42, 28, 20, 32,
];

function formatSecs(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function AssignedAudio() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh } = useLive();

  useHeader('Assigned Audio', 'Listen to your assigned audio files, transcribe and submit for review');

  // Backend real assignments only
  const res = useResource(() => audioApi.assigned(), [user.id]);
  const realList = res.data || [];

  // Map real backend assignments
  const allTracks = useMemo(() => {
    if (!realList || !Array.isArray(realList)) return [];
    return realList.map((r, i) => {
      const cleanName = (r.track?.originalName || 'Audio.mp3').replace(/^[_\s-]+/, '');
      const st = r.status || 'in_progress';
      let statusColor = 'blue';
      let statusLabel = 'In Progress';
      if (st === 'assigned' || st === 'pending') { statusColor = 'amber'; statusLabel = 'Pending'; }
      else if (st === 'submitted') { statusColor = 'green'; statusLabel = 'Submitted'; }
      else if (st === 'revision_requested' || st === 'revision') { statusColor = 'red'; statusLabel = 'Revision'; }
      return {
        id: r.track?.id || r.assignmentId || `r-${i}`,
        assignmentId: r.assignmentId,
        originalName: cleanName,
        packageName: r.projectName || 'Transcription',
        duration: r.track?.duration || 0,
        assignedAt: r.assignedAt ? new Date(r.assignedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        status: st,
        statusLabel,
        statusColor,
        iconColor: i % 2 === 0 ? 'blue' : i % 3 === 0 ? 'purple' : 'coral',
        adminInstruction: r.reviewFeedback || 'Please listen carefully and transcribe the audio accurately.',
        notes: r.notes || '',
        history: r.history || [],
        realTrack: r.track,
      };
    });
  }, [realList]);

  // Active filter tab: 'all' | 'pending' | 'in_progress' | 'submitted' | 'revision'
  const [filter, setFilter] = useState('all');

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (filter === 'all') return allTracks;
    if (filter === 'pending') return allTracks.filter((t) => t.status === 'assigned' || t.status === 'pending');
    if (filter === 'in_progress') return allTracks.filter((t) => t.status === 'in_progress');
    if (filter === 'submitted') return allTracks.filter((t) => t.status === 'submitted');
    if (filter === 'revision') return allTracks.filter((t) => t.status === 'revision' || t.status === 'revision_requested');
    return allTracks;
  }, [allTracks, filter]);

  // Track Counts
  const counts = useMemo(() => ({
    all: allTracks.length,
    pending: allTracks.filter((t) => t.status === 'assigned' || t.status === 'pending').length,
    in_progress: allTracks.filter((t) => t.status === 'in_progress').length,
    submitted: allTracks.filter((t) => t.status === 'submitted').length,
    revision: allTracks.filter((t) => t.status === 'revision' || t.status === 'revision_requested').length,
  }), [allTracks]);

  // Selected track state
  const [selectedId, setSelectedId] = useState(null);
  const [mobileTab, setMobileTab] = useState('list');

  const selectedTrack = useMemo(() => {
    if (!allTracks.length) return null;
    if (selectedId) {
      const found = allTracks.find((t) => t.id === selectedId);
      if (found) return found;
    }
    return allTracks[0];
  }, [allTracks, selectedId]);

  useEffect(() => {
    if (selectedTrack && selectedId !== selectedTrack.id) {
      setSelectedId(selectedTrack.id);
    }
  }, [selectedTrack, selectedId]);

  // Pagination state
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredTracks.length / PAGE_SIZE) || 1;
  const paginatedTracks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTracks.slice(start, start + PAGE_SIZE);
  }, [filteredTracks, page]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Editor Drafts state
  const [drafts, setDrafts] = useState({});
  const [lastSaved, setLastSaved] = useState('saved');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef(null);

  const textValue = selectedTrack ? (drafts[selectedTrack.id] ?? selectedTrack.notes ?? '') : '';

  // Word count
  const wordCount = useMemo(() => {
    const t = textValue.trim();
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [textValue]);

  // Audio Player State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Sync selected track duration & reset playback
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (selectedTrack?.duration) {
      setDuration(selectedTrack.duration);
    } else {
      setDuration(0);
    }
  }, [selectedTrack]);

  const togglePlay = () => {
    if (!selectedTrack?.realTrack) {
      toast('No audio file available for this track.');
      return;
    }
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
          toast('Could not play audio. File may be missing or unreadable.');
        });
    }
  };

  const seek = (pct) => {
    if (!duration || duration <= 0) return;
    const target = duration * pct;
    setCurrentTime(target);
    if (audioRef.current) audioRef.current.currentTime = target;
  };

  const progressPct = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  // Format Text helper
  const formatText = (prefix, suffix = '') => {
    if (!selectedTrack) return;
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = textValue.substring(start, end);
    const replacement = prefix + (sel || 'text') + suffix;
    const updated = textValue.substring(0, start) + replacement + textValue.substring(end);
    setDrafts((d) => ({ ...d, [selectedTrack.id]: updated }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + (sel.length || 4));
    }, 10);
  };

  // Save Draft
  const saveDraft = async () => {
    if (!selectedTrack) return;
    setSaving(true);
    try {
      if (selectedTrack.realTrack?.id) {
        await audioApi.saveNote(selectedTrack.realTrack.id, textValue);
        refresh();
      }
      setLastSaved('just now');
      toast('Draft saved to your account.');
    } catch (e) {
      toast(e.message || 'Error saving draft.');
    } finally {
      setSaving(false);
    }
  };

  // Submit for Review
  const submitReview = async () => {
    if (!selectedTrack) return;
    if (!textValue.trim()) return toast('Enter your transcription before submitting.');
    setSubmitting(true);
    try {
      if (selectedTrack.realTrack?.id) {
        await audioApi.saveNote(selectedTrack.realTrack.id, textValue);
        if (selectedTrack.assignmentId) await audioApi.submit(selectedTrack.assignmentId);
        refresh();
      }
      toast('Transcription submitted for review.');
    } catch (e) {
      toast(e.message || 'Submission error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pulse-split-workspace">
      {/* Real audio element if valid stream exists */}
      <audio
        ref={audioRef}
        preload="metadata"
        src={selectedTrack?.realTrack ? audioUrl(selectedTrack.realTrack) : undefined}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          if (isPlaying) {
            setIsPlaying(false);
            toast('Audio file could not be loaded.');
          }
        }}
      />

      {/* Mobile Tab Toggle Bar (visible only on mobile/tablets) */}
      <div className="mobile-audio-tabs">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'list' ? 'active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>Audio Files ({counts.all})</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'editor' ? 'active' : ''}`}
          onClick={() => setMobileTab('editor')}
          disabled={!selectedTrack}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>Transcription {selectedTrack ? `(${selectedTrack.originalName.slice(0, 10)}...)` : ''}</span>
        </button>
      </div>

      {/* 2-Column Split Master Detail View */}
      <div className={`split-grid mobile-view-${mobileTab}`}>
        {/* ================= LEFT MASTER LIST ================= */}
        <section className="track-list-panel">
          {/* Filter Pills */}
          <div className="filter-pill-bar">
            <button
              type="button"
              className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({counts.pending})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setFilter('in_progress')}
            >
              In Progress ({counts.in_progress})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'submitted' ? 'active' : ''}`}
              onClick={() => setFilter('submitted')}
            >
              Submitted ({counts.submitted})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'revision' ? 'active' : ''}`}
              onClick={() => setFilter('revision')}
            >
              Revision ({counts.revision})
            </button>
          </div>

          {/* Cards List or Empty State */}
          <div className="track-cards-scroll">
            {allTracks.length === 0 ? (
              <div className="empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <h4 style={{ margin: '0 0 6px', color: 'var(--text)' }}>No audio assigned yet</h4>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Your assigned audio files will appear here.</p>
              </div>
            ) : paginatedTracks.length === 0 ? (
              <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No audio files found for filter: {filter.replace('_', ' ')}.</p>
              </div>
            ) : (
              paginatedTracks.map((item) => {
                const isSelected = selectedTrack && item.id === selectedTrack.id;
                return (
                  <div
                    key={item.id}
                    className={`track-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileTab('editor');
                    }}
                  >
                    {/* Left Music Icon */}
                    <div className={`track-icon-box icon-${item.iconColor || 'blue'}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>

                    {/* Center Details */}
                    <div className="track-item-info">
                      <h4 className="track-item-title">{item.originalName}</h4>
                      <div className="track-item-meta">
                        <span className="pkg-tag">{item.packageName}</span>
                        {item.duration > 0 && (
                          <span className="meta-sep">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatSecs(item.duration)}
                          </span>
                        )}
                        {item.assignedAt && (
                          <span className="meta-sep">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {item.assignedAt}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Status Badge & Play button */}
                    <div className="track-item-actions">
                      <span className={`status-pill status-${item.statusColor}`}>
                        {item.statusLabel}
                      </span>
                      <button
                        type="button"
                        className="track-play-circle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                          setMobileTab('editor');
                          togglePlay();
                        }}
                        title={isPlaying && isSelected ? 'Pause' : 'Play'}
                      >
                        {isPlaying && isSelected ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="6 4 19 12 6 20 6 4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="track-pagination">
              <button
                type="button"
                className="page-arrow"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`page-num ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="page-arrow"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                &gt;
              </button>
            </div>
          )}
        </section>

        {/* ================= RIGHT WORKSPACE ================= */}
        {selectedTrack ? (
          <section className="track-detail-panel">
            {/* Header Card */}
            <div className="selected-track-header">
              <div className="track-icon-box lg icon-purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="selected-track-titles">
                <div className="selected-title-row">
                  <h3 className="selected-track-title">{selectedTrack.originalName}</h3>
                  <span className={`status-pill status-${selectedTrack.statusColor}`}>
                    {selectedTrack.statusLabel}
                  </span>
                </div>
                <div className="selected-meta-row">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    {selectedTrack.packageName}
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatSecs(duration)}
                  </span>
                  {selectedTrack.assignedAt && (
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {selectedTrack.assignedAt}
                    </span>
                  )}
                </div>
              </div>
              <div className="selected-header-nav">
                <button
                  type="button"
                  className="icon-btn-round"
                  title="Back to list"
                  onClick={() => setMobileTab('list')}
                >
                  &lt;
                </button>
              </div>
            </div>

            {/* Audio Player Bar */}
            <div className="workspace-player-card">
              {/* Play Button */}
              <button
                type="button"
                className="player-round-play"
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#07111f">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#07111f" style={{ marginLeft: 2 }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>

              {/* Time */}
              <span className="player-time-txt">
                {formatSecs(currentTime)} / {formatSecs(duration)}
              </span>

              {/* Waveform with cyan-to-purple gradient */}
              <div
                className="waveform-bar-wrap"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  seek(Math.max(0, Math.min(1, pos)));
                }}
              >
                {WAVE_BARS.map((h, i) => {
                  const pct = i / WAVE_BARS.length;
                  const active = pct <= progressPct;
                  return (
                    <span
                      key={i}
                      className={`wave-col ${active ? 'active' : ''}`}
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>

              {/* Speed */}
              <div className="speed-wrap">
                <button
                  type="button"
                  className="speed-btn"
                  onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                >
                  <span>{playbackRate}x</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {speedMenuOpen && (
                  <div className="speed-menu">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(r);
                          setSpeedMenuOpen(false);
                          if (audioRef.current) audioRef.current.playbackRate = r;
                        }}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume */}
              <div className="volume-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                />
              </div>
            </div>

            {/* Admin Instruction Box */}
            <div className="admin-instruction-card">
              <div className="admin-circle-avatar">AD</div>
              <div className="admin-inst-body">
                <div className="admin-inst-header">
                  <strong>Admin Instruction</strong>
                  {selectedTrack.assignedAt && <small>{selectedTrack.assignedAt}</small>}
                </div>
                <p className="admin-inst-text">
                  {selectedTrack.adminInstruction}
                </p>
              </div>
            </div>

            {/* "Your Transcription" Box */}
            <div className="transcription-workspace-card">
              <div className="card-top-head">
                <div className="card-title-txt">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Your Transcription</span>
                </div>
                <div className="card-top-meta">
                  <span className="auto-save-green">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Auto-saved {lastSaved}
                  </span>
                  <span className="word-count-badge">Word count: {wordCount}</span>
                </div>
              </div>

              {/* Rich Text Toolbar */}
              <div className="editor-action-bar">
                <div className="action-bar-left">
                  <button type="button" className="tool-btn-sm" title="Undo" onClick={() => document.execCommand('undo')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                  </button>
                  <button type="button" className="tool-btn-sm" title="Redo" onClick={() => document.execCommand('redo')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                  </button>
                  <span className="tool-sep" />
                  <button type="button" className="tool-btn-sm" title="Bold" onClick={() => formatText('**', '**')}><strong>B</strong></button>
                  <button type="button" className="tool-btn-sm" title="Italic" onClick={() => formatText('*', '*')}><em>I</em></button>
                  <button type="button" className="tool-btn-sm" title="Underline" onClick={() => formatText('<u>', '</u>')}><u>U</u></button>
                  <span className="tool-sep" />
                  <button type="button" className="tool-btn-sm" title="Bullet list" onClick={() => formatText('\n• ')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  </button>
                  <button type="button" className="tool-btn-sm" title="Numbered list" onClick={() => formatText('\n1. ')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                  </button>
                </div>

                <div className="action-bar-right">
                  <select className="select-text-style">
                    <option>Normal text</option>
                    <option>Heading 1</option>
                    <option>Heading 2</option>
                  </select>
                  <button type="button" className="tool-btn-sm" title="Expand">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={editorRef}
                className="transcription-edit-area"
                rows={8}
                placeholder="Start typing the transcription here... (Manual typing required - Paste disabled)"
                value={textValue}
                onChange={(e) => {
                  setDrafts({ ...drafts, [selectedTrack.id]: e.target.value });
                  setLastSaved('just now');
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  toast('Pasting is disabled. Please type the transcription manually.');
                }}
                onCopy={(e) => {
                  e.preventDefault();
                  toast('Copying transcription text is disabled.');
                }}
                onCut={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  toast('Drag and drop is disabled. Please type the transcription manually.');
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                    e.preventDefault();
                    toast('Pasting is disabled. Please type the transcription manually.');
                  }
                  if (e.shiftKey && e.key === 'Insert') {
                    e.preventDefault();
                    toast('Pasting is disabled. Please type the transcription manually.');
                  }
                  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                    e.preventDefault();
                    toast('Copying transcription text is disabled.');
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}
              />
            </div>

            {/* Action Cards (Save Draft & Submit for Review) */}
            <div className="transcription-actions-split">
              <button
                type="button"
                className="action-split-card card-save-draft"
                disabled={saving}
                onClick={saveDraft}
              >
                <div className="action-icon-box teal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </div>
                <div className="action-text-block">
                  <strong>{saving ? 'Saving...' : 'Save Draft'}</strong>
                  <p>Draft will be saved to your account</p>
                </div>
              </button>

              <button
                type="button"
                className="action-split-card card-submit-review"
                disabled={submitting}
                onClick={submitReview}
              >
                <div className="action-icon-box blue-grad">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <div className="action-text-block">
                  <strong>{submitting ? 'Submitting...' : 'Submit for Review'}</strong>
                  <p>Submit when transcription is complete</p>
                </div>
              </button>
            </div>

            {/* Submission History */}
            <div className="submission-history-panel">
              <div className="history-title-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <h4>Submission History ({selectedTrack.history?.length || 0})</h4>
              </div>

              <div className="history-items-list">
                {selectedTrack.history && selectedTrack.history.length > 0 ? (
                  selectedTrack.history.slice().reverse().map((h, idx) => (
                    <div key={idx} className="history-row-item">
                      <div className="history-status-circle green">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="history-text-col">
                        <div className="history-entry-top">
                          <strong>Version {h.version || idx + 1} Submitted</strong>
                          <small>{h.submittedAt ? new Date(h.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}</small>
                        </div>
                        <p>{h.text ? (h.text.slice(0, 80) + (h.text.length > 80 ? '...' : '')) : 'Complete transcription submitted.'}</p>
                      </div>
                      <button type="button" className="btn-view-history" onClick={() => toast(`Viewing version ${h.version || idx + 1}`)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>View</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    No submission history yet for this track.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* Empty detail panel when no audio is assigned / selected */
          <section className="track-detail-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 440 }}>
              <div className="track-icon-box lg icon-blue" style={{ margin: '0 auto 16px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>No Audio Selected</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                {allTracks.length === 0
                  ? 'No audio assigned yet. Your assigned audio files will appear here.'
                  : 'Select an assigned audio file from the list on the left to start playback and transcription.'}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
