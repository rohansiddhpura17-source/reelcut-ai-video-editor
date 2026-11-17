import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileVideo,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Clock,
  Film,
  HardDrive,
  FolderOpen,
  Plus
} from 'lucide-react';
import { ProjectState, ProjectSummary, VideoMetadata } from '../../types';

interface UploadVideoProps {
  project: ProjectState;
  onVideoUploaded: (file: File) => Promise<void>;
  onStartAnalysis: () => void;
  isUploading: boolean;
  uploadProgress: number;
  recentProjects: ProjectSummary[];
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
}

export const UploadVideo: React.FC<UploadVideoProps> = ({
  project,
  onVideoUploaded,
  onStartAnalysis,
  isUploading,
  uploadProgress,
  recentProjects,
  onOpenProject,
  onNewProject,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = project.metadata;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndUpload = (file: File) => {
    setError(null);
    const validExtensions = ['mp4', 'mov', 'webm', 'm4v'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(ext)) {
      setError('Please upload a valid MP4 or MOV video file.');
      return;
    }

    // 500MB maximum file limit check
    if (file.size > 500 * 1024 * 1024) {
      setError('File size exceeds the 500MB limit for local processing.');
      return;
    }

    onVideoUploaded(file).catch((err) => {
      setError(err.message || 'Failed to upload video');
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // justify-start (not center): with a long recent-projects list the
  // content is taller than the viewport, and justify-center would push
  // the top of the page above the scrollable area, making the heading
  // -- and eventually the list itself -- unreachable.
  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col items-center justify-start min-h-[calc(100vh-3.5rem)]">
      {/* Hidden file input lives outside the upload/uploaded conditional so
          "Choose different video" works after a video is already loaded. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={handleFileInput}
        className="hidden"
      />
      {/* Title & Header */}
      <div className="text-center max-w-2xl mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Stage 01 • Video Ingestion</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3">
          Upload Raw Talking-Head Footage
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Upload a 3–5 minute raw recording. ReelCut AI detects long pauses, awkward fillers,
          and repetitive takes, reframes to vertical 9:16, burns captions, and exports a tight reel under 60 seconds.
        </p>
      </div>

      {/* Main Upload Dropzone or Uploaded Metadata Card */}
      {!meta ? (
        <div className="w-full max-w-2xl">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
              dragActive
                ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                : 'border-slate-700 hover:border-slate-500 bg-[#0F172A]/60'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <p className="text-white font-semibold text-base mb-1">
              {isUploading ? 'Uploading and Probing Metadata...' : 'Drop raw video here, or browse files'}
            </p>
            <p className="text-slate-400 text-xs mb-4">
              Supports MP4, MOV up to 500MB • 1080p or 4K recommended
            </p>

            {isUploading ? (
              <div className="w-full max-w-xs mt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Uploading</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-teal-500/20"
                >
                  Select Video File
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        /* Video Metadata Overview Card */
        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <FileVideo className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base truncate max-w-sm">{meta.filename}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="uppercase text-[11px] font-semibold text-teal-400">{meta.format}</span>
                  <span>•</span>
                  <span>{formatBytes(meta.sizeBytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Footage Ready</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 my-6">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
              <span className="text-slate-500 text-[11px] flex items-center space-x-1 mb-1">
                <Clock className="w-3 h-3" />
                <span>Raw Duration</span>
              </span>
              <span className="text-lg font-bold text-white font-mono">{formatDuration(meta.duration)}</span>
              <span className="text-[10px] text-slate-500">({meta.duration.toFixed(1)}s)</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
              <span className="text-slate-500 text-[11px] flex items-center space-x-1 mb-1">
                <Film className="w-3 h-3" />
                <span>Resolution</span>
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {meta.width}x{meta.height}
              </span>
              <span className="text-[10px] text-teal-400/80">16:9 Landscape</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
              <span className="text-slate-500 text-[11px] flex items-center space-x-1 mb-1">
                <HardDrive className="w-3 h-3" />
                <span>Frame Rate</span>
              </span>
              <span className="text-lg font-bold text-white font-mono">{meta.fps} FPS</span>
              <span className="text-[10px] text-slate-500">Standard</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
              <span className="text-slate-500 text-[11px] flex items-center space-x-1 mb-1">
                <Sparkles className="w-3 h-3" />
                <span>Target Reel</span>
              </span>
              <span className="text-lg font-bold text-teal-400 font-mono">&le; 60s</span>
              <span className="text-[10px] text-slate-500">9:16 Vertical</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = '';
                fileInputRef.current?.click();
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Choose different video
            </button>

            <button
              onClick={onStartAnalysis}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
            >
              <span>Run AI Video Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Recent projects: reopen earlier work instead of starting over.
          Empty stubs (no video uploaded yet) are marked as such and sort
          below real work, so they are never mistaken for finished reels. */}
      {recentProjects.length > 0 && (
        <div className="w-full max-w-2xl mt-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <FolderOpen className="w-4 h-4 text-teal-400" />
              <span>Recent projects</span>
            </span>
            <button
              onClick={onNewProject}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New project</span>
            </button>
          </div>
          <div className="space-y-2">
            {recentProjects.map((p) => {
              const isCurrent = p.id === project.id;
              const status = p.hasAnalysis
                ? 'Analysed'
                : p.hasVideo
                  ? 'Video uploaded'
                  : 'Empty — no video yet';
              const when = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '';
              return (
                <button
                  key={p.id}
                  onClick={() => !isCurrent && onOpenProject(p.id)}
                  disabled={isCurrent}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    isCurrent
                      ? 'bg-teal-500/10 border-teal-500/40 cursor-default'
                      : p.hasVideo
                        ? 'bg-slate-900/80 border-slate-800 hover:border-teal-500/40'
                        : 'bg-slate-950/60 border-slate-900 opacity-60 hover:opacity-90'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-white truncate">
                      {p.name}
                      {isCurrent && <span className="text-teal-400"> • Current</span>}
                    </span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {when}
                      {p.duration ? ` • ${formatDuration(p.duration)}` : ''}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      p.hasAnalysis
                        ? 'bg-teal-500/15 text-teal-300 border-teal-500/40'
                        : p.hasVideo
                          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
