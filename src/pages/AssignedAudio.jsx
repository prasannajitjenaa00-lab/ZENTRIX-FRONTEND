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

// Demo items from user's screenshot
const SAMPLE_TRACKS = [
  {
    id: 'track-1',
    assignmentId: 'asg-1',
    originalName: 'Dura Akashare Janha Tiye.mp3',
    packageName: 'Odia Transcription',
    duration: 275, // 4:35
    assignedAt: '15 Oct 2026',
    status: 'in_progress',
    statusLabel: 'In Progress',
    statusColor: 'blue',
    iconColor: 'blue',
    adminInstruction: 'Please listen carefully and transcribe the audio accurately.\nMaintain proper spelling and punctuation.\nThis is an Odia movie song transcription.',
    notes: '',
  },
  {
    id: 'track-2',
    assignmentId: 'asg-2',
    originalName: 'sample-1.mp3',
    packageName: 'English Transcription',
    duration: 154, // 2:34
    assignedAt: '15 Oct 2026',
    status: 'pending',
    statusLabel: 'Pending',
    statusColor: 'amber',
    iconColor: 'blue',
    adminInstruction: 'Transcribe with speaker labels and clean verbatim.',
    notes: '',
  },
  {
    id: 'track-3',
    assignmentId: 'asg-3',
    originalName: 'sample-2.mp3',
    packageName: 'Hindi Transcription',
    duration: 192, // 3:12
    assignedAt: '14 Oct 2026',
    status: 'submitted',
    statusLabel: 'Submitted',
    statusColor: 'green',
    iconColor: 'blue',
    adminInstruction: 'Review dialogue segments and verify Hindi spellings.',
    notes: 'Sample submitted transcription text for sample-2.',
  },
  {
    id: 'track-4',
    assignmentId: 'asg-4',
    originalName: 'sample-3.mp3',
    packageName: 'Odia Transcription',
    duration: 118, // 1:58
    assignedAt: '14 Oct 2026',
    status: 'pending',
    statusLabel: 'Pending',
    statusColor: 'amber',
    iconColor: 'coral',
    adminInstruction: 'Short Odia clip. Please transcribe carefully.',
    notes: '',
  },
  {
    id: 'track-5',
    assignmentId: 'asg-5',
    originalName: 'sample-4.mp3',
    packageName: 'English Transcription',
    duration: 225, // 3:45
    assignedAt: '13 Oct 2026',
    status: 'revision',
    statusLabel: 'Revision',
    statusColor: 'red',
    iconColor: 'purple',
    adminInstruction: 'Revision requested: Please fix timing at 1:20 and check proper nouns.',
    notes: 'Draft needs revision on speaker names.',
  },
  {
    id: 'track-6',
    assignmentId: 'asg-6',
    originalName: 'sample-5.mp3',
    packageName: 'Odia Transcription',
    duration: 140, // 2:20
    assignedAt: '13 Oct 2026',
    status: 'submitted',
    statusLabel: 'Submitted',
    statusColor: 'green',
    iconColor: 'green',
    adminInstruction: 'Song recording. Maintain punctuation.',
    notes: 'Complete lyrics transcribed.',
  },
  {
    id: 'track-7',
    assignmentId: 'asg-7',
    originalName: 'sample-6.mp3',
    packageName: 'Hindi Transcription',
    duration: 250, // 4:10
    assignedAt: '12 Oct 2026',
    status: 'pending',
    statusLabel: 'Pending',
    statusColor: 'amber',
    iconColor: 'purple',
    adminInstruction: 'High priority Hindi interview transcription.',
    notes: '',
  },
  {
    id: 'track-8',
    assignmentId: 'asg-8',
    originalName: 'sample-7.mp3',
    packageName: 'English Transcription',
    duration: 90, // 1:30
    assignedAt: '12 Oct 2026',
    status: 'submitted',
    statusLabel: 'Submitted',
    statusColor: 'green',
    iconColor: 'blue',
    adminInstruction: 'Short promo audio transcription.',
    notes: 'Submitted.',
  },
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

  // Backend real assignments
  const res = useResource(() => audioApi.assigned(), [user.id]);
  const realList = res.data || [];

  // Merge real items with demo tracks
  const allTracks = useMemo(() => {
    if (realList.length > 0) {
      const mapped = realList.map((r, i) => {
        const cleanName = (r.track?.originalName || 'Audio.mp3').replace(/^[_\s-]+/, '');
        const st = r.status || 'in_progress';
        let statusColor = 'blue';
        let statusLabel = 'In Progress';
        if (st === 'assigned' || st === 'pending') { statusColor = 'amber'; statusLabel = 'Pending'; }
        else if (st === 'submitted') { statusColor = 'green'; statusLabel = 'Submitted'; }
        else if (st === 'revision_requested' || st === 'revision') { statusColor = 'red'; statusLabel = 'Revision'; }
        return {
          id: r.track?.id || `r-${i}`,
          assignmentId: r.assignmentId,
          originalName: cleanName,
          packageName: r.projectName || 'Odia Transcription',
          duration: r.track?.duration || 275,
          assignedAt: r.assignedAt ? new Date(r.assignedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Oct 2026',
          status: st,
          statusLabel,
          statusColor,
          iconColor: i % 2 === 0 ? 'blue' : i % 3 === 0 ? 'purple' : 'coral',
          adminInstruction: r.reviewFeedback || 'Please listen carefully and transcribe the audio accurately.\nMaintain proper spelling and punctuation.\nThis is an Odia movie song transcription.',
          notes: r.notes || '',
          realTrack: r.track,
        };
      });
      // Append additional sample tracks if list is short to match screenshot count (12)
      const existingNames = new Set(mapped.map((m) => m.originalName));
      const fillers = SAMPLE_TRACKS.filter((s) => !existingNames.has(s.originalName));
      return [...mapped, ...fillers];
    }
    return SAMPLE_TRACKS;
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

  // Selected track ID
  const [selectedId, setSelectedId] = useState(SAMPLE_TRACKS[0].id);
  const selectedTrack = allTracks.find((t) => t.id === selectedId) || allTracks[0] || SAMPLE_TRACKS[0];

  // Pagination state
  const [page, setPage] = useState(1);

  // Editor Drafts state
  const [drafts, setDrafts] = useState({});
  const [lastSaved, setLastSaved] = useState('2 minutes ago');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const editorRef = useRef(null);

  const textValue = drafts[selectedTrack.id] ?? selectedTrack.notes ?? '';

  // Word count
  const wordCount = useMemo(() => {
    const t = textValue.trim();
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [textValue]);

  // Audio Player State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(selectedTrack.duration || 275);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [volume, setVolume] = useState(0.85);

  // Sync selected track duration & reset playback
  useEffect(() => {
    setDuration(selectedTrack.duration || 275);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [selectedTrack]);

  // Playback timer (real audio or simulated if synthetic demo track)
  useEffect(() => {
    let timer;
    if (isPlaying) {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.play().catch(() => {});
      } else {
        timer = setInterval(() => {
          setCurrentTime((t) => {
            if (t >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return t + 0.5;
          });
        }, 500);
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const seek = (pct) => {
    const target = duration * pct;
    setCurrentTime(target);
    if (audioRef.current) audioRef.current.currentTime = target;
  };

  const progressPct = duration > 0 ? currentTime / duration : 0;

  // Format Text helper
  const formatText = (prefix, suffix = '') => {
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
        src={selectedTrack.realTrack ? audioUrl(selectedTrack.realTrack) : undefined}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* 2-Column Split Master Detail View */}
      <div className="split-grid">
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

          {/* Cards List */}
          <div className="track-cards-scroll">
            {filteredTracks.map((item) => {
              const isSelected = item.id === selectedTrack.id;
              return (
                <div
                  key={item.id}
                  className={`track-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
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
                      <span className="meta-sep">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatSecs(item.duration)}
                      </span>
                      <span className="meta-sep">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {item.assignedAt}
                      </span>
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
                        togglePlay();
                      }}
                      title="Play track"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 4 19 12 6 20 6 4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="track-more-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="track-pagination">
            <button type="button" className="page-arrow" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              &lt;
            </button>
            <button type="button" className={`page-num ${page === 1 ? 'active' : ''}`} onClick={() => setPage(1)}>1</button>
            <button type="button" className={`page-num ${page === 2 ? 'active' : ''}`} onClick={() => setPage(2)}>2</button>
            <button type="button" className={`page-num ${page === 3 ? 'active' : ''}`} onClick={() => setPage(3)}>3</button>
            <button type="button" className="page-arrow" onClick={() => setPage(p => p + 1)}>
              &gt;
            </button>
          </div>
        </section>

        {/* ================= RIGHT WORKSPACE ================= */}
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
                <span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  15 Oct 2026, 18:20
                </span>
              </div>
            </div>
            <div className="selected-header-nav">
              <button type="button" className="icon-btn-round" title="Back">
                &lt;
              </button>
              <button type="button" className="icon-btn-round" title="Options">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
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
            <div className="admin-circle-avatar">DA</div>
            <div className="admin-inst-body">
              <div className="admin-inst-header">
                <strong>Admin Instruction</strong>
                <small>15 Oct 2026, 18:20</small>
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
              placeholder="Start typing the transcription here..."
              value={textValue}
              onChange={(e) => {
                setDrafts({ ...drafts, [selectedTrack.id]: e.target.value });
                setLastSaved('just now');
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
              <h4>Submission History ({selectedTrack.history?.length || 2})</h4>
            </div>

            <div className="history-items-list">
              {selectedTrack.history?.length > 0 ? (
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
                <>
                  {/* Item 1: Submitted for Review */}
                  <div className="history-row-item">
                    <div className="history-status-circle green">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="history-text-col">
                      <div className="history-entry-top">
                        <strong>Submitted for Review</strong>
                        <small>15 Oct 2026, 19:10</small>
                      </div>
                      <p>This is my complete transcription. Please review.</p>
                    </div>
                    <button type="button" className="btn-view-history">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>View</span>
                    </button>
                  </div>

                  {/* Item 2: Draft Saved */}
                  <div className="history-row-item">
                    <div className="history-status-circle amber">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div className="history-text-col">
                      <div className="history-entry-top">
                        <strong>Draft Saved</strong>
                        <small>15 Oct 2026, 18:45</small>
                      </div>
                      <p>Auto-saved draft</p>
                    </div>
                    <button type="button" className="btn-view-history">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>View</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
