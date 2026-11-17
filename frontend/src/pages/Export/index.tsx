import React, { useState } from 'react';
import {
  Download,
  Sparkles,
  CheckCircle2,
  Film,
  HardDrive,
  Layers,
  Clock,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Share2,
  Check
} from 'lucide-react';
import { ProjectState, RenderJob, RenderOptions } from '../../types';
import { capTo60, formatClock } from '../../utils/duration';
import { estimateRenderSizeBytes } from '../../utils/estimate';

interface ExportStudioProps {
  project: ProjectState;
  onStartRender: (options: RenderOptions) => Promise<void>;
  isRendering: boolean;
  renderJob?: RenderJob;
}

export const ExportStudio: React.FC<ExportStudioProps> = ({
  project,
  onStartRender,
  isRendering,
  renderJob,
}) => {
  const [resolution, setResolution] = useState<'1080x1920' | '720x1280'>('1080x1920');
  const [fps, setFps] = useState<30 | 60>(30);
  const [qualityPreset, setQualityPreset] = useState<'high' | 'balanced' | 'compact'>('high');
  const [filename, setFilename] = useState<string>(
    `${project.name.toLowerCase().replace(/\s+/g, '_')}_reel.mp4`
  );
  const [copied, setCopied] = useState<boolean>(false);

  const meta = project.metadata;
  const plannedDur = project.editPlan?.estimatedFinalDuration || 54;
  const cap = capTo60(project.editPlan?.retainedIntervals || []);
  const cappedDur = project.editPlan?.retainedIntervals?.length
    ? Math.min(plannedDur, cap.keptDuration)
    : Math.min(plannedDur, 60);
  const isOver60 = plannedDur > 60;

  // Realistic size estimate: bits-per-pixel model (see utils/estimate.ts),
  // calibrated against two real renders (720p60/high: +15.8%, 1080p30/
  // balanced: -3.2%). The old source-bitrate formula ignored fps, so it
  // estimated 2.3 MB for a 720p/60fps render that came out at 4.13 MB.
  const estimatedSizeBytes = estimateRenderSizeBytes({
    sourceSizeBytes: meta?.sizeBytes,
    sourceDurationSec: meta?.duration,
    sourceWidth: meta?.width,
    sourceHeight: meta?.height,
    sourceFps: meta?.fps,
    outWidth: resolution === '720x1280' ? 720 : 1080,
    outHeight: resolution === '720x1280' ? 1280 : 1920,
    outFps: fps,
    qualityPreset,
    durationSec: cappedDur,
  });
  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const sanitizedFilename = (() => {
    const raw = (filename || 'reelcut_final.mp4').trim();
    const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '_') || 'reelcut_final.mp4';
    return safe.toLowerCase().endsWith('.mp4') ? safe : `${safe}.mp4`;
  })();

  const buildOptions = (): RenderOptions => ({
    resolution,
    fps,
    qualityPreset,
    filename: sanitizedFilename,
  });

  const isCompleted = renderJob?.status === 'completed' && renderJob?.outputVideoUrl;
  const isFailed = renderJob?.status === 'failed';

  // Download via fetch + blob URL so the typed filename is honoured: the
  // server's Content-Disposition (backend filename) would otherwise win
  // over the anchor's download attribute.
  const handleDownload = async () => {
    if (!renderJob?.outputVideoUrl) return;
    try {
      const res = await fetch(renderJob.outputVideoUrl);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      const a = document.createElement('a');
      a.href = renderJob.outputVideoUrl;
      a.download = sanitizedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]">
      {/* Title */}
      <div className="text-center max-w-xl mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Stage 09 • Real Video Export Studio</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Export Final ReelCut MP4
        </h1>
        <p className="text-slate-400 text-sm">
          FFmpeg renders approved cuts, applies vertical 9:16 face-framing, burns kinetic captions, and exports a verified MP4
          {isOver60
            ? ` — the planned reel is ${plannedDur.toFixed(1)}s, so the export keeps only the first 60s.`
            : ' under 60 seconds.'}
        </p>
      </div>

      {/* Main Studio Card */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Export Parameters Form */}
        <div className="space-y-5 mb-6">
          {/* Resolution Options */}
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Export Resolution (9:16 Vertical)
            </span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: '1080x1920', label: '1080 x 1920 (FHD)', desc: 'Best for Instagram Reels & TikTok' },
                { id: '720x1280', label: '720 x 1280 (HD)', desc: 'Fast rendering, smaller file size' },
              ].map((res) => (
                <button
                  key={res.id}
                  onClick={() => setResolution(res.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    resolution === res.id
                      ? 'bg-teal-500/15 border-teal-500/50 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs mb-0.5">{res.label}</div>
                  <div className="text-[11px] text-slate-500">{res.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality & Framerate Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Frame Rate
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[30, 60].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFps(f as any)}
                    className={`py-2 rounded-lg font-mono text-xs font-semibold border transition-all ${
                      fps === f
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Quality Preset
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['high', 'balanced', 'compact'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQualityPreset(q)}
                    className={`py-2 rounded-lg capitalize text-xs font-medium border transition-all ${
                      qualityPreset === q
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filename Input */}
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              Output Filename
            </span>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Metadata Specs Strip */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block text-[10px]">Estimated Duration</span>
              <span className="font-mono text-teal-400 font-bold">
                {isOver60 ? `${plannedDur.toFixed(1)}s → ${cappedDur.toFixed(1)}s` : `${plannedDur.toFixed(1)}s`}
              </span>
              <span className="text-[10px] text-slate-500"> {isOver60 ? '(capped at 60s)' : '(≤ 60s limit)'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Estimated Size</span>
              <span className="font-mono text-white font-bold">{formatBytes(estimatedSizeBytes)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Encoding Codec</span>
              <span className="font-mono text-white font-bold">H.264 / AAC</span>
            </div>
          </div>

          {/* 60s cap warning: names the kept footage that will be dropped */}
          {isOver60 && cap.dropped.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">60-second cap:</span> the planned reel is {plannedDur.toFixed(1)}s.
                The export keeps only the first 60s — the following kept footage will NOT appear in the final reel:{' '}
                {cap.dropped.map((iv) => `${formatClock(iv.start)}–${formatClock(iv.end)} (${(iv.end - iv.start).toFixed(1)}s)`).join(', ')}.
              </div>
            </div>
          )}
        </div>

        {/* Live Rendering State or Action Button */}
        {isRendering ? (
          <div className="p-5 rounded-xl bg-slate-950 border border-teal-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-teal-300 font-semibold flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>{renderJob?.currentStep || 'Rendering video with FFmpeg...'}</span>
              </span>
              <span className="font-mono font-bold text-white">
                {renderJob?.progressPercent || 25}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-indigo-500 to-teal-400 transition-all duration-300"
                style={{ width: `${renderJob?.progressPercent || 25}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Applying cut concatenation, 9:16 vertical crop, subtitle burning, title card, and audio fades.
            </p>
          </div>
        ) : isCompleted ? (
          <div className="p-5 rounded-xl bg-teal-950/40 border border-teal-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-teal-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <span>Video Rendered Successfully!</span>
              </div>
              <span className="text-xs font-mono text-teal-400 bg-teal-900/60 px-2.5 py-1 rounded-full border border-teal-500/30">
                {renderJob.finalDuration ? `${renderJob.finalDuration}s` : `${plannedDur.toFixed(1)}s`} • MP4
                {renderJob.outputResolution ? ` • ${renderJob.outputResolution}` : ` • ${resolution}`}
                {renderJob.outputFps ? ` • ${renderJob.outputFps}fps` : ` • ${fps}fps`}
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Your 9:16 reel is ready for download. Playable across phones, Instagram, TikTok, and YouTube Shorts.
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-teal-500/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download MP4 Video</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + renderJob.outputVideoUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-teal-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Share Link'}</span>
              </button>
            </div>
          </div>
        ) : isFailed ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center space-x-2 text-rose-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Rendering Error</span>
            </div>
            <p className="text-xs text-rose-200">{renderJob?.error || 'FFmpeg process failed'}</p>
            <button
              onClick={() => onStartRender(buildOptions())}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
            >
              Retry Render
            </button>
          </div>
        ) : (
          <button
            onClick={() => onStartRender(buildOptions())}
            className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-teal-500/25 transition-all transform active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Render & Export Final Reel</span>
          </button>
        )}
      </div>
    </div>
  );
};
