import { useRef, useState } from 'react';
import { audioApi } from '../services';
import { uploadTracks } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { useToast } from '../contexts/ToastContext';
import { useHeader } from '../layouts/HeaderContext';
import { useResource } from '../hooks/useResource';
import { Page, Resource } from '../components/Page';
import { MAX_PROJECT_UPLOAD } from '../utils/format';

function readAudioDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration && Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}

export default function UploadAudioView() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh } = useLive();
  useHeader('Upload Audio', 'Upload your audio file');

  const projects = useResource(() => audioApi.projects(), [user.id]);
  const fileInputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  const handleFiles = (filesList) => {
    const list = Array.from(filesList || []);
    if (!list.length) return;
    const audioFiles = list.filter((f) => /\.mp3$/i.test(f.name) || /audio\//i.test(f.type || ''));
    if (!audioFiles.length) {
      toast('Please select valid MP3 or audio files.');
      return;
    }
    if (audioFiles.length > MAX_PROJECT_UPLOAD) {
      toast(`You can select at most ${MAX_PROJECT_UPLOAD} files at a time.`);
      return;
    }
    setSelectedFiles(audioFiles);
    setStatusMsg('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const getOrCreateProject = async (plist) => {
    if (plist?.length) return plist[0].id;
    const created = await audioApi.createProject({
      name: 'Audio Uploads',
      description: 'Studio uploaded audio tracks',
    });
    return created.id;
  };

  const startUpload = async (plist) => {
    if (!selectedFiles.length) return toast('Please select audio files first.');

    setUploading(true);
    setUploadPct(0);
    setStatusMsg(`Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}…`);

    try {
      const projectId = await getOrCreateProject(plist);
      const durations = {};
      await Promise.all(
        selectedFiles.map(async (f) => {
          const d = await readAudioDuration(f);
          if (d) durations[f.name] = d;
        })
      );
      const out = await uploadTracks(projectId, selectedFiles, (progress) => {
        setUploadPct(Math.round(progress * 100));
        setStatusMsg(`Uploading… ${Math.round(progress * 100)}%`);
      }, durations);



      const ok = out.tracks?.length || 0;
      toast(`Successfully uploaded ${ok} audio file${ok === 1 ? '' : 's'}!`);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMsg('');
      refresh();
    } catch (err) {
      toast(err.message || 'Upload failed.');
      setStatusMsg(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <Resource res={projects}>{(plist) => (
      <Page>
        <div style={{ maxWidth: 660, margin: '20px auto 0' }}>
          <section className="panel" style={{ padding: '28px 24px' }}>
            <h3 style={{ fontSize: 18, marginBottom: 4 }}>Upload your audio file</h3>
            <p className="hint" style={{ margin: '0 0 20px', fontSize: 13 }}>
              Drag and drop your audio files below or browse from your computer.
            </p>

            {/* Drag & Drop Area */}
            <div
              className="upload-drop"
              style={{
                border: isDragging ? '2px dashed #12c2d4' : '1px dashed rgba(18, 194, 212, 0.45)',
                background: isDragging ? 'rgba(18, 194, 212, 0.18)' : 'rgba(18, 194, 212, 0.08)',
                borderRadius: 14,
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />

              <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
              <strong style={{ display: 'block', fontSize: 16, color: '#fff', marginBottom: 6 }}>
                Drag &amp; Drop audio files here
              </strong>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
                Supports MP3 and audio formats (Up to {MAX_PROJECT_UPLOAD} files)
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ margin: '0 auto', pointerEvents: 'none' }}
              >
                Browse Audio Files
              </button>
            </div>

            {/* Selected Files Preview List */}
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: 'var(--primary)' }}>
                    Selected ({selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'})
                  </strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
                    onClick={() => {
                      setSelectedFiles([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(0, 0, 0, 0.25)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%', color: '#fff', fontWeight: 600 }}>
                        🎵 {idx + 1} MP3
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>

                {/* Upload Button */}
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={uploading}
                    onClick={() => startUpload(plist)}
                    style={{ width: '100%', padding: '12px 18px', fontWeight: 600, fontSize: 14 }}
                  >
                    {uploading ? `Uploading… ${uploadPct}%` : `Upload ${selectedFiles.length} Audio File${selectedFiles.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploading && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{statusMsg}</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="progress-bar tall">
                  <span style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            )}

            {statusMsg && !uploading && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--primary)', textAlign: 'center' }}>
                {statusMsg}
              </div>
            )}
          </section>
        </div>
      </Page>
    )}</Resource>
  );
}
