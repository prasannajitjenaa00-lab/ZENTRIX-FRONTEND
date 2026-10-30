import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { audioApi, tasksApi } from '../services';
import { audioUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useNav } from '../contexts/NavContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { validateTranscriptRules } from '../utils/transcriptRules';

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

export { validateTranscriptRules };

export default function AssignedAudio() {
  const { user } = useAuth();
  const nav = useNav();
  const toast = useToast();
  const { refresh } = useLive();

  useHeader('Audio Task', 'Listen to your assigned audio file, transcribe and submit for review');

  // Backend real assignments only
  const res = useResource(() => audioApi.assigned(), [user.id], { live: false });
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
      else if (st === 'approved' || st === 'reviewed') { statusColor = 'green'; statusLabel = 'Approved'; }
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
  const [selectedId, setSelectedId] = useState(nav.audioId || nav.trackId || null);
  const [mobileTab, setMobileTab] = useState(nav.audioId || nav.trackId || nav.taskTitle ? 'detail' : 'list');

  // If navigated from "My Tasks" edit with audioId, trackId, or taskTitle, find and select that particular audio
  useEffect(() => {
    if (!allTracks.length) return;
    if (nav.audioId) {
      const found = allTracks.find((t) => t.id === nav.audioId || t.assignmentId === nav.audioId || t.realTrack?.id === nav.audioId);
      if (found) {
        setSelectedId(found.id);
        setFilter('all');
        setMobileTab('detail');
        return;
      }
    }
    if (nav.trackId) {
      const found = allTracks.find((t) => t.realTrack?.id === nav.trackId || t.id === nav.trackId);
      if (found) {
        setSelectedId(found.id);
        setFilter('all');
        setMobileTab('detail');
        return;
      }
    }
    if (nav.taskTitle) {
      const q = nav.taskTitle.toLowerCase();
      const found = allTracks.find((t) => {
        const name = (t.originalName || '').toLowerCase();
        const pkg = (t.packageName || '').toLowerCase();
        return name.includes(q) || q.includes(name) || pkg.includes(q) || q.includes(pkg);
      });
      if (found) {
        setSelectedId(found.id);
        setFilter('all');
        setMobileTab('detail');
      }
    }
  }, [nav.audioId, nav.trackId, nav.taskTitle, allTracks]);

  const selectedTrack = useMemo(() => {
    if (!allTracks.length) return null;
    if (selectedId) {
      const found = allTracks.find((t) => t.id === selectedId);
      if (found) return found;
    }
    // For 1-by-1 sequential queue: prioritize active uncompleted audio
    const active = allTracks.find((t) => ['assigned', 'in_progress', 'revision', 'revision_requested'].includes(t.status));
    if (active) return active;
    return allTracks[allTracks.length - 1] || allTracks[0];
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

  // Real-time 6-rule validation check
  const ruleCheck = useMemo(() => validateTranscriptRules(textValue), [textValue]);

  // Handle typing in transcription editor
  const handleTextChange = (e) => {
    const raw = e.target.value;
    setDrafts((prev) => ({ ...prev, [selectedTrack.id]: raw }));
    setLastSaved('just now');
  };

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
  const lastSyncRef = useRef(0);
  const currentTrackIdRef = useRef(null);

  const syncListenedTime = (forcedSeconds) => {
    if (!selectedTrack?.realTrack?.id) return;
    const trackId = selectedTrack.realTrack.id;
    const cur = forcedSeconds != null ? forcedSeconds : Math.floor(audioRef.current?.currentTime || 0);
    const prevStored = Number(localStorage.getItem('listened_' + trackId)) || 0;
    const maxVal = Math.max(prevStored, cur);
    localStorage.setItem('listened_' + trackId, maxVal);
    audioApi.saveNote(trackId, textValue, maxVal).catch(() => {});
  };

  // Sync selected track duration & reset playback ONLY when switching to a different track
  useEffect(() => {
    const nextTrackId = selectedTrack?.id || null;
    if (currentTrackIdRef.current === nextTrackId) {
      if (selectedTrack?.duration && !duration) setDuration(selectedTrack.duration);
      return;
    }
    currentTrackIdRef.current = nextTrackId;

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
  }, [selectedTrack?.id]);

  // Auto-pause playback when tab becomes inactive or window is minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
        syncListenedTime();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
        const curSec = Math.floor(audioRef.current?.currentTime || 0);
        await audioApi.saveNote(selectedTrack.realTrack.id, textValue, curSec);
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

    const validation = validateTranscriptRules(textValue);
    const isApproved = validation.passed;
    const targetStatus = isApproved ? 'Approved' : 'Pending';
    const targetProgress = isApproved ? 100 : 50;

    setSubmitting(true);
    try {
      if (selectedTrack.realTrack?.id) {
        const curSec = Math.floor(audioRef.current?.currentTime || 0);
        await audioApi.saveNote(selectedTrack.realTrack.id, textValue, curSec);
        if (selectedTrack.assignmentId) {
          await audioApi.submit(selectedTrack.assignmentId);
        }
      }

      // If a task ID was provided (or exists in user's tasks matching this track/assignment)
      const passedTaskId = nav.params?.taskId;
      if (passedTaskId) {
        try {
          await tasksApi.updateStatus(passedTaskId, { status: targetStatus, progress: targetProgress });
        } catch {
          // fallback if already handled by server
        }
      }

      // Update local selectedTrack state immediately
      selectedTrack.status = isApproved ? 'approved' : 'pending';
      selectedTrack.statusLabel = isApproved ? 'Approved' : 'Pending';
      selectedTrack.statusColor = isApproved ? 'green' : 'amber';

      // Advance 1-by-1 queue: clear selectedId so next pending audio is auto-selected
      setSelectedId(null);
      refresh();
      if (isApproved) {
        toast("Transcription passed all rules and was auto-approved! 🎉");
      } else {
        toast(`Submitted (Pending): ${validation.failures[0] || 'Rules need manual correction.'}`);
      }
    } catch (e) {
      toast(e.message || 'Submission error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="audio-task-page-wrap">
      {/* Real audio element for stream playback */}
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
          if (audioRef.current) {
            const cur = audioRef.current.currentTime;
            setCurrentTime(cur);
            if (selectedTrack?.realTrack?.id) {
              const trackId = selectedTrack.realTrack.id;
              const curSec = Math.floor(cur);
              const prevStored = Number(localStorage.getItem('listened_' + trackId)) || 0;
              if (curSec > prevStored) {
                localStorage.setItem('listened_' + trackId, curSec);
              }
              const now = Date.now();
              if (now - lastSyncRef.current > 4000) {
                lastSyncRef.current = now;
                audioApi.saveNote(trackId, textValue, Math.max(prevStored, curSec)).catch(() => {});
              }
            }
          }
        }}
        onPause={() => syncListenedTime()}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          syncListenedTime(selectedTrack?.duration || Math.floor(audioRef.current?.duration || 0));
        }}
        onError={() => {
          if (isPlaying) {
            setIsPlaying(false);
            toast('Audio file could not be loaded.');
          }
        }}
      />

      <div className="audio-task-card">
        {/* Top left title */}
        <h2 className="audio-task-heading">Audio Task</h2>

        {selectedTrack ? (
          <>
            {/* Centered Dark Charcoal Slate Audio Player Box */}
            <div className="audio-task-player-box">
              {/* Row 1: Play/Pause, Scrubber, Time, Volume */}
              <div className="audio-player-top-row">
                <button
                  type="button"
                  className="audio-play-toggle-btn"
                  onClick={togglePlay}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="4" width="4" height="16" rx="1" />
                      <rect x="15" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max={duration > 0 ? duration : 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    const target = parseFloat(e.target.value);
                    setCurrentTime(target);
                    if (audioRef.current) audioRef.current.currentTime = target;
                  }}
                  className="audio-timeline-slider"
                />

                <span className="audio-time-label">
                  {formatSecs(currentTime)} / {formatSecs(duration)}
                </span>

                <div className="audio-vol-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
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
                    className="audio-volume-slider"
                  />
                </div>
              </div>

              {/* Row 2: Speed slider */}
              <div className="audio-player-bottom-row">
                <span className="audio-speed-title">Speed:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={playbackRate}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    setPlaybackRate(r);
                    if (audioRef.current) audioRef.current.playbackRate = r;
                  }}
                  className="audio-speed-slider"
                />
                <span className="audio-speed-val">{playbackRate.toFixed(1)}x</span>
              </div>
            </div>

            {/* Write Here label */}
            <div className="audio-write-label">Write Here</div>

            {/* Editor frame matching screenshot */}
            <div className="audio-editor-frame">
              {/* Toolbar */}
              <div className="audio-editor-toolbar">
                {/* Bold */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Bold"
                  onClick={() => formatText('**', '**')}
                  style={{ fontWeight: 700 }}
                >
                  B
                </button>

                {/* Underline */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Underline"
                  onClick={() => formatText('<u>', '</u>')}
                  style={{ textDecoration: 'underline' }}
                >
                  U
                </button>

                <span className="editor-tool-vsep" />

                {/* Highlight A */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Highlight"
                  onClick={() => formatText('<mark>', '</mark>')}
                  style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>A</span>
                  <span style={{ width: 12, height: 2.5, background: '#eab308', borderRadius: 1 }} />
                </button>

                <span className="editor-tool-vsep" />

                {/* Bullet list */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Bullet list"
                  onClick={() => formatText('\n• ')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="9" y1="6" x2="20" y2="6" />
                    <line x1="9" y1="12" x2="20" y2="12" />
                    <line x1="9" y1="18" x2="20" y2="18" />
                    <circle cx="4" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
                  </svg>
                </button>

                {/* Numbered list */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Numbered list"
                  onClick={() => formatText('\n1. ')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="10" y1="6" x2="21" y2="6" />
                    <line x1="10" y1="12" x2="21" y2="12" />
                    <line x1="10" y1="18" x2="21" y2="18" />
                    <path d="M4 6h1v4" />
                    <path d="M4 10h2" />
                    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
                  </svg>
                </button>

                {/* Indent / Align */}
                <button
                  type="button"
                  className="editor-tool-btn"
                  title="Align / Indent"
                  onClick={() => formatText('  ')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="21" y1="10" x2="7" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="7" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={editorRef}
                className="audio-editor-textarea"
                rows={10}
                placeholder=""
                value={textValue}
                onChange={handleTextChange}
                spellCheck={true}
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

              {/* Resize pill at bottom center */}
              <div className="audio-editor-bottom-bar">
                <span className="audio-editor-resize-pill" />
              </div>
            </div>

            {/* Dark teal Submit Button */}
            <button
              type="button"
              className="audio-task-submit-btn"
              disabled={submitting}
              onClick={submitReview}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <p style={{ fontSize: 16, margin: '0 0 6px', color: '#1e293b', fontWeight: 600 }}>No Audio Task Assigned</p>
            <p style={{ fontSize: 13, margin: 0 }}>Please wait for an admin to assign an audio task.</p>
          </div>
        )}
      </div>
    </div>
  );
}