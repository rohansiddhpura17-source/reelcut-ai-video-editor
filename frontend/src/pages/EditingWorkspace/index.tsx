import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Scissors,
  CheckCircle2,
  Sparkles,
  Layers,
  Type,
  Crop,
  FileText,
  Sliders,
  Maximize2,
  AlertCircle,
  Eye,
  Undo2,
  Redo2,
  ChevronRight
} from 'lucide-react';
import {
  ProjectState,
  TranscriptSegment,
  EditSuggestion,
  ScreenName
} from '../../types';

interface WorkspaceProps {
  project: ProjectState;
  onNavigate: (screen: ScreenName) => void;
  onToggleSegmentKeep: (segmentId: string) => void;
  onUpdateSuggestion: (suggestionId: string, decision: 'cut' | 'keep', approved: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const EditingWorkspace: React.FC<WorkspaceProps> = ({
  project,
  onNavigate,
  onToggleSegmentKeep,
  onUpdateSuggestion,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'plan' | 'transcript' | 'captions' | 'crop' | 'title' | 'audio'>('plan');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const meta = project.metadata;
  const duration = meta?.duration || 60;
  const transcript = project.transcript || [];
  const plan = project.editPlan;
  const suggestions = plan?.suggestions || [];

  // Active segment at current playhead
  const currentSegment = transcript.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  ) || transcript[0];

  const selectedSegment = transcript.find((s) => s.id === selectedSegmentId) || currentSegment;

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const seek = (time: number) => {
    const clamped = Math.max(0, Math.min(duration, time));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const formatTime = (timeInSec: number) => {
    const m = Math.floor(timeInSec / 60);
    const s = Math.floor(timeInSec % 60);
    const ms = Math.floor((timeInSec % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden select-none bg-[#090D16]">
      {/* 3-Column Center Stage */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Tools & Inspectors */}
        <div className="w-80 border-r border-slate-800 bg-[#0B0F17] flex flex-col">
          {/* Subtabs Header: wraps so every tab stays visible at 320px wide */}
          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-800 bg-slate-950/60">
            {[
              { id: 'plan', label: 'Plan', icon: <Scissors className="w-3.5 h-3.5" /> },
              { id: 'transcript', label: 'Script', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'captions', label: 'Captions', icon: <Type className="w-3.5 h-3.5" /> },
              { id: 'crop', label: 'Crop 9:16', icon: <Crop className="w-3.5 h-3.5" /> },
              { id: 'title', label: 'Title Card', icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'audio', label: 'Audio', icon: <Sliders className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLeftTab(tab.id as any)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  leftTab === tab.id
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Left Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {leftTab === 'plan' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Approved Cuts ({suggestions.length})</span>
                  <button
                    onClick={() => onNavigate('edit_plan')}
                    className="text-[11px] text-teal-400 hover:underline flex items-center"
                  >
                    <span>Edit Plan</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {suggestions.slice(0, 8).map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => seek(sug.startTime)}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200 capitalize">{sug.type}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {sug.duration.toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{sug.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftTab === 'transcript' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Transcript Sentences</span>
                  <button
                    onClick={() => onNavigate('transcript')}
                    className="text-[11px] text-teal-400 hover:underline flex items-center"
                  >
                    <span>Full Editor</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {transcript.map((seg) => (
                    <div
                      key={seg.id}
                      onClick={() => {
                        setSelectedSegmentId(seg.id);
                        seek(seg.start);
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSegment?.id === seg.id
                          ? 'bg-teal-500/10 border-teal-500/50 text-white'
                          : seg.isKept
                          ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                          : 'bg-slate-950 border-slate-900 text-slate-600 line-through'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                        <span>{formatTime(seg.start)}</span>
                        <span>{seg.isKept ? 'Kept' : 'Cut'}</span>
                      </div>
                      <p className="text-xs leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftTab === 'captions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Caption Styling</span>
                  <button
                    onClick={() => onNavigate('captions')}
                    className="text-[11px] text-teal-400 hover:underline flex items-center"
                  >
                    <span>Studio</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Font</span>
                    <span className="text-white font-semibold">{project.captions.fontFamily}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Highlight Color</span>
                    <span className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: project.captions.highlightColor }} />
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Words per screen</span>
                    <span className="text-white">{project.captions.wordsPerBatch} words</span>
                  </div>
                </div>
              </div>
            )}

            {leftTab === 'crop' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Vertical 9:16 Framing</span>
                  <button
                    onClick={() => onNavigate('crop')}
                    className="text-[11px] text-teal-400 hover:underline flex items-center"
                  >
                    <span>Adjust Crop</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Mode</span>
                    <span className="text-teal-400 font-medium">{project.crop.mode === 'auto_face' ? 'Auto Face-Tracking' : 'Manual Framing'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Zoom Factor</span>
                    <span className="text-white">{project.crop.zoom}x</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Face Detected</span>
                    {project.crop.faceDetected ? (
                      <span className="text-teal-400">Yes ({Math.round(project.crop.faceConfidence * 100)}% conf)</span>
                    ) : (
                      <span className="text-amber-400">No face — centred crop</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {leftTab === 'title' && (
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-200">Opening Title Card</span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <span className="text-[11px] text-slate-500">Title Text</span>
                  <p className="font-bold text-white text-sm">{project.titleCard.title}</p>
                  <p className="text-xs text-teal-400">{project.titleCard.subtitle}</p>
                  <span className="text-[10px] text-slate-500 block">Duration: {project.titleCard.durationSeconds}s</span>
                </div>
              </div>
            )}

            {leftTab === 'audio' && (
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-200">Audio Fades & Tuning</span>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Fade In</span>
                    <span className="text-white">{project.audio.fadeInSeconds}s</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fade Out</span>
                    <span className="text-white">{project.audio.fadeOutSeconds}s</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Normalization</span>
                    <span className={project.audio.normalize ? 'text-teal-400' : 'text-slate-500'}>{project.audio.normalize ? 'Enabled' : 'Off'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Noise Reduction</span>
                    <span className={project.audio.reduceNoise ? 'text-teal-400' : 'text-slate-500'}>{project.audio.reduceNoise ? 'Enabled' : 'Off'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Panel: 9:16 Video Canvas & Controls */}
        <div className="flex-1 bg-[#090D16] flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {/* Vertical 9:16 Frame Container */}
          <div className="h-[92%] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-800 relative flex items-center justify-center group">
            {meta?.videoUrl ? (
              <video
                ref={videoRef}
                src={meta.videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-cover"
                muted={isMuted}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                <Crop className="w-12 h-12 text-slate-700 mb-2" />
                <span className="text-xs font-medium">9:16 Vertical Preview Frame</span>
              </div>
            )}

            {/* Overlaid Title Card (during first seconds if enabled) */}
            {project.titleCard.enabled && currentTime < project.titleCard.durationSeconds && (
              <div className="absolute top-16 inset-x-4 p-4 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-center animate-fade-in pointer-events-none">
                <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                  {project.titleCard.title}
                </h2>
                <p className="text-xs text-teal-400 font-semibold mt-0.5">
                  {project.titleCard.subtitle}
                </p>
              </div>
            )}

            {/* Overlaid Kinetic Captions */}
            {project.captions.enabled && currentSegment && currentSegment.isKept && (
              <div
                className="absolute inset-x-4 text-center pointer-events-none transition-all duration-200"
                style={{
                  top: `${project.captions.yOffsetPercent}%`,
                  transform: 'translateY(-50%)',
                }}
              >
                <div
                  className="inline-block px-4 py-2 rounded-xl backdrop-blur-md"
                  style={{
                    backgroundColor: project.captions.backgroundColor,
                    fontFamily: project.captions.fontFamily,
                  }}
                >
                  <p
                    className="text-base font-extrabold tracking-wide uppercase drop-shadow-md"
                    style={{ color: project.captions.textColor }}
                  >
                    {currentSegment.words && currentSegment.words.length > 0 ? (
                      currentSegment.words.map((w, idx) => {
                        const isCurrentWord = currentTime >= w.start && currentTime <= w.end;
                        return (
                          <span
                            key={idx}
                            className={`mx-1 transition-all ${
                              isCurrentWord
                                ? 'scale-110 drop-shadow-lg'
                                : 'opacity-85'
                            }`}
                            style={{
                              color: isCurrentWord
                                ? project.captions.highlightColor
                                : project.captions.textColor,
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })
                    ) : (
                      <span>{currentSegment.text}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Play/Pause overlay */}
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform">
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </div>
            </button>
          </div>

          {/* Video Transport Controls Bar */}
          <div className="w-full max-w-md mt-3 flex items-center justify-between px-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => seek(currentTime - 5)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Rewind className="w-4 h-4" />
              </button>

              <button
                onClick={handlePlayPause}
                className="p-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-md shadow-teal-500/20"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={() => seek(currentTime + 5)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <FastForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Timecode display */}
            <div className="font-mono text-xs text-slate-300">
              <span className="text-teal-400 font-bold">{formatTime(currentTime)}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-500">{formatTime(duration)}</span>
            </div>

            {/* Playback speed toggle */}
            <div className="flex items-center space-x-1">
              {[1, 1.5, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => {
                    setPlaybackSpeed(spd);
                    if (videoRef.current) videoRef.current.playbackRate = spd;
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-teal-500/20 text-teal-300 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Segment Inspector & AI Suggestions */}
        <div className="w-80 border-l border-slate-800 bg-[#0B0F17] flex flex-col p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200">Segment Inspector</span>
            <span className="text-[10px] font-mono text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-500/30">
              {selectedSegment?.id || 'seg_1'}
            </span>
          </div>

          {selectedSegment ? (
            <div className="space-y-4 text-xs">
              {/* Timing metadata */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Start</span>
                  <span className="font-mono font-bold text-white">{formatTime(selectedSegment.start)}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">End</span>
                  <span className="font-mono font-bold text-white">{formatTime(selectedSegment.end)}</span>
                </div>
              </div>

              {/* Spoken content */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Transcript Line
                </span>
                <p className="text-slate-200 text-xs italic font-serif leading-relaxed">
                  "{selectedSegment.text}"
                </p>
              </div>

              {/* Decision Toggle */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Cut / Retain Action
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onToggleSegmentKeep(selectedSegment.id)}
                    className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg font-semibold text-xs transition-all ${
                      selectedSegment.isKept
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Keep In Reel</span>
                  </button>

                  <button
                    onClick={() => onToggleSegmentKeep(selectedSegment.id)}
                    className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg font-semibold text-xs transition-all ${
                      !selectedSegment.isKept
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cut Segment</span>
                  </button>
                </div>
              </div>

              {/* AI Recommendation Context */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-1.5 text-teal-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-semibold text-xs">AI Recommendation</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {selectedSegment.isKept
                    ? 'Retaining this sentence maintains narrative momentum and context.'
                    : 'Cutting this section removes pause/repetition and preserves the sub-60s reel duration.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs text-center py-8">
              Select any segment on the timeline or in the script to inspect.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Interactive Multi-Track Timeline */}
      <div className="h-44 border-t border-slate-800 bg-[#0B0F17] flex flex-col p-3">
        {/* Timeline Header & Undo / Zoom controls */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-300">Intelligent Edit Timeline</span>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-teal-500" />
                <span>Retained</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/50" />
                <span>Cut / Removed</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                <span>Silence Marker</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded bg-indigo-400" />
                <span>Filler Marker</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-400">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo last transcript change"
              className="p-1 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
              className="p-1 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Timeline Tracks Area */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            seek(pct * duration);
          }}
          className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/80 relative overflow-hidden cursor-pointer"
        >
          {/* Time ruler ticks */}
          <div className="h-4 border-b border-slate-800/60 flex items-center justify-between px-2 text-[9px] font-mono text-slate-600">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i}>{formatTime((i / 8) * duration)}</span>
            ))}
          </div>

          {/* Segment Blocks Track */}
          <div className="h-10 my-1 px-1 flex items-center space-x-0.5 relative">
            {transcript.map((seg) => {
              const segDur = seg.end - seg.start;
              const widthPct = (segDur / duration) * 100;
              const isSelected = selectedSegment?.id === seg.id;
              return (
                <div
                  key={seg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSegmentId(seg.id);
                    seek(seg.start);
                  }}
                  className={`h-full rounded transition-all relative overflow-hidden flex items-center px-1 text-[10px] font-medium border ${
                    isSelected
                      ? 'border-white z-10 scale-[1.02] shadow-lg'
                      : 'border-transparent'
                  } ${
                    seg.isKept
                      ? 'bg-teal-600/80 text-teal-100 hover:bg-teal-500'
                      : 'bg-rose-950/60 text-rose-400 line-through border-rose-900/60'
                  }`}
                  style={{ width: `${Math.max(1.5, widthPct)}%` }}
                  title={`${seg.text} (${segDur.toFixed(1)}s)`}
                >
                  <span className="truncate">{seg.text}</span>
                </div>
              );
            })}
          </div>

          {/* Markers Track (Silences & Fillers) */}
          <div className="h-4 px-1 flex items-center relative">
            {project.analysis?.silences.map((s) => {
              const leftPct = (s.start / duration) * 100;
              const widthPct = Math.max(0.8, (s.duration / duration) * 100);
              return (
                <div
                  key={s.id}
                  className="absolute h-2.5 rounded-full bg-amber-400/80"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`Silence: ${s.duration}s`}
                />
              );
            })}
            {project.analysis?.fillers.map((f) => {
              const leftPct = (f.start / duration) * 100;
              return (
                <div
                  key={f.id}
                  className="absolute h-2.5 w-1.5 rounded-full bg-indigo-400"
                  style={{ left: `${leftPct}%` }}
                  title={`Filler: ${f.word}`}
                />
              );
            })}
          </div>

          {/* Playhead Indicator */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none z-20"
            style={{ left: `${(currentTime / Math.max(1, duration)) * 100}%` }}
          >
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-[4px] -mt-[2px] shadow-md shadow-red-500/50" />
          </div>
        </div>
      </div>
    </div>
  );
};
