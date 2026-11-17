import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Scissors,
  CheckCircle2,
  ArrowRight,
  Eye,
  Columns,
  Clock,
  Layers,
  Download
} from 'lucide-react';
import { ProjectState, ScreenName } from '../../types';

interface PreviewProps {
  project: ProjectState;
  onNavigate: (screen: ScreenName) => void;
  onStartRender: () => void;
}

export const PreviewPage: React.FC<PreviewProps> = ({
  project,
  onNavigate,
  onStartRender,
}) => {
  const [activeTab, setActiveTab] = useState<'comparison' | 'rendered'>('comparison');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const meta = project.metadata;
  const renderJob = project.renderJob;
  const renderedUrl = renderJob?.outputVideoUrl;

  const originalDur = meta?.duration || 180;
  // After a real render, show the actual output duration; before that the
  // plan duration is only an estimate and must be labelled as such.
  const isRendered = !!renderedUrl && renderJob?.status === 'completed';
  const editedDur = isRendered && renderJob?.finalDuration != null
    ? renderJob.finalDuration
    : project.editPlan?.estimatedFinalDuration || 54;
  const timeSaved = Math.max(0, originalDur - editedDur);
  const percentReduction = Math.round((timeSaved / Math.max(1, originalDur)) * 100);
  const over60 = editedDur > 60;

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Screen 08 • Final Preview & Before/After Comparison</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Review AI Reel & Cadence
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Compare raw 16:9 unedited footage with the tightened 9:16 vertical cut before final MP4 export.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'comparison'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Before & After</span>
          </button>

          <button
            onClick={() => onNavigate('export')}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
          >
            <span>Proceed to Export Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-500 block mb-1">Raw Footage Duration</span>
          <span className="text-xl font-bold text-slate-300 font-mono">{formatSec(originalDur)}</span>
          <span className="text-[10px] text-slate-500 block">Original 16:9</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-500 block mb-1">Final Reel Duration</span>
          <span className={`text-xl font-bold font-mono ${over60 ? 'text-amber-400' : 'text-teal-400'}`}>{formatSec(editedDur)}</span>
          <span className={`text-[10px] block ${over60 ? 'text-amber-400' : 'text-teal-500'}`}>
            {isRendered ? 'Rendered duration' : over60 ? 'Planned — exceeds 60s, export keeps first 60s' : 'Planned — ≤ 60s target met'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-500 block mb-1">Cadence Compression</span>
          <span className="text-xl font-bold text-indigo-400 font-mono">-{percentReduction}%</span>
          <span className="text-[10px] text-slate-500 block">{timeSaved.toFixed(1)}s {isRendered ? 'cut in render' : 'planned reduction'}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] text-slate-500 block mb-1">Output Format</span>
          <span className="text-xl font-bold text-white font-mono">9:16 MP4</span>
          <span className="text-[10px] text-slate-500 block">
            {renderJob?.outputResolution ? `${renderJob.outputResolution} • H.264` : 'H.264 • resolution set in Export Studio'}
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison Stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start flex-1 mb-6">
        {/* Left: Original 16:9 Uncut */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col items-center shadow-xl backdrop-blur-xl">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Before • Raw Footage (Uncut)
            </span>
            <span className="font-mono text-xs text-slate-500">{formatSec(originalDur)}</span>
          </div>

          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center">
            {meta?.videoUrl ? (
              <video
                src={meta.videoUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-slate-600 text-xs">Original Video Player</div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-3 text-center">
            Raw footage before AI cuts.
          </p>
        </div>

        {/* Right: AI-Edited 9:16 Reel with Captions & Framing */}
        <div className="bg-slate-900/80 border border-teal-500/30 rounded-2xl p-5 flex flex-col items-center shadow-xl shadow-teal-500/5 backdrop-blur-xl">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>After • ReelCut 9:16 Reel</span>
            </span>
            <span className="font-mono text-xs text-teal-400 font-bold">{formatSec(editedDur)}</span>
          </div>

          <div className="w-[240px] aspect-[9/16] bg-black rounded-xl overflow-hidden relative border-2 border-teal-500/50 shadow-2xl flex flex-col items-center justify-center group">
            {renderedUrl ? (
              <video
                src={renderedUrl}
                controls
                className="w-full h-full object-cover"
              />
            ) : meta?.videoUrl ? (
              <video
                src={meta.videoUrl}
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-slate-600 text-xs">Vertical Reel Player</div>
            )}

            {/* Captions badge: only claims active captions after a real render */}
            <div className="absolute bottom-6 inset-x-2 text-center pointer-events-none">
              <span className={`px-3 py-1 rounded bg-black/80 font-extrabold text-xs uppercase tracking-wide border shadow-lg ${renderedUrl ? 'text-teal-300 border-teal-500/30' : 'text-slate-400 border-slate-500/30'}`}>
                {renderedUrl ? 'CAPTIONS ACTIVE' : 'CAPTIONS PREVIEW — NOT YET RENDERED'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-teal-400/80 mt-3 text-center font-medium">
            {renderedUrl
              ? 'Silences cut • Face centered in 9:16 • Title card added • Audio fades applied'
              : 'Preview of the planned reel — render in Export Studio to apply cuts, captions and the title card.'}
          </p>
        </div>
      </div>
    </div>
  );
};
