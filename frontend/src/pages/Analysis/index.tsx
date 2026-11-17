import React from 'react';
import {
  Cpu,
  CheckCircle2,
  Loader2,
  Volume2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Repeat
} from 'lucide-react';
import { ProjectState } from '../../types';

interface AnalysisProps {
  project: ProjectState;
  isAnalyzing: boolean;
  onProceedToPlan: () => void;
  onReanalyze: () => void;
}

export const Analysis: React.FC<AnalysisProps> = ({
  project,
  isAnalyzing,
  onProceedToPlan,
  onReanalyze,
}) => {
  const analysis = project.analysis;
  const meta = project.metadata;

  const steps = [
    { name: 'Audio Track Extraction & Demuxing', done: !!analysis, active: isAnalyzing },
    { name: 'Speech Recognition & Word Timestamps', done: !!analysis, active: isAnalyzing },
    { name: 'Silence & Dead-Air Detection (≥0.75s detected, ≥1.0s proposed as cuts)', done: !!analysis, active: false },
    { name: 'Filler-Word Identification (um, ah, like)', done: !!analysis, active: false },
    { name: 'Sentence Repetition & False-Start Matching', done: !!analysis, active: false },
    { name: 'Drafting 60s Smart Edit Plan', done: !!analysis, active: false },
  ];

  const silenceCount = analysis?.silences.length || 0;
  const fillerCount = analysis?.fillers.length || 0;
  const repetitionCount = analysis?.repetitions.length || 0;
  const timeSaved = analysis?.estimatedSavingSeconds || 0;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto flex flex-col items-center">
      {/* Title */}
      <div className="text-center max-w-xl mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
          <Cpu className="w-3.5 h-3.5" />
          <span>Stage 02 • AI Speech & Cadence Analysis</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          {isAnalyzing ? 'Analyzing Video Recording...' : 'Speech Analysis Complete'}
        </h1>
        <p className="text-slate-400 text-sm">
          {isAnalyzing
            ? 'Whisper speech model and FFmpeg audio filters are identifying dead air, filler words, and repetitions.'
            : 'AI analysis has identified proposed cuts. You have final approval over every edit before anything is cut.'}
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Waveform overview: bar heights are illustrative. The indigo and
            rose ticks are real detection markers, positioned by timestamp. */}
        <div className="h-24 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex items-center justify-center space-x-1.5 overflow-hidden mb-1 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-indigo-500/10 to-teal-500/5" />
          {Array.from({ length: 48 }).map((_, i) => {
            const h = Math.sin(i * 0.4) * 35 + 40;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-300 ${
                  isAnalyzing ? 'bg-teal-400 animate-pulse' : 'bg-teal-500/60'
                }`}
                style={{ height: `${h}%`, animationDelay: `${i * 30}ms` }}
              />
            );
          })}
          {!isAnalyzing && analysis && analysis.fillers.map((f) => (
            <div
              key={f.id}
              className="absolute top-2 bottom-2 w-[3px] bg-indigo-400 rounded-full pointer-events-none"
              style={{ left: `${(f.start / Math.max(1, meta?.duration || 1)) * 100}%` }}
              title={`Filler: ${f.word}`}
            />
          ))}
          {!isAnalyzing && analysis && analysis.repetitions.map((r) => (
            <div
              key={r.id}
              className="absolute top-2 bottom-2 w-[3px] bg-rose-400 rounded-full pointer-events-none"
              style={{ left: `${(r.start / Math.max(1, meta?.duration || 1)) * 100}%` }}
              title="Repetition"
            />
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mb-6">
          Bars are illustrative. Indigo ticks mark real detected fillers; rose ticks mark real repetitions.
        </p>

        {/* Pipeline Step Checklist */}
        <div className="space-y-2.5 mb-6">
          {steps.map((st, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800/60"
            >
              <div className="flex items-center space-x-3">
                {st.done ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                ) : st.active ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700" />
                )}
                <span className={`text-xs font-medium ${st.done ? 'text-slate-200' : 'text-slate-400'}`}>
                  {st.name}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {st.done ? 'Finished' : st.active ? 'Processing...' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        {/* Results Metrics */}
        {analysis && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-slate-500 text-[11px] block mb-1">Silences</span>
              <span className="text-xl font-bold text-amber-400 font-mono">{silenceCount}</span>
              <span className="text-[10px] text-slate-500 block">pauses</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-slate-500 text-[11px] block mb-1">Filler Words</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">{fillerCount}</span>
              <span className="text-[10px] text-slate-500 block">um, ah, like</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-slate-500 text-[11px] block mb-1">Repetitions</span>
              <span className="text-xl font-bold text-rose-400 font-mono">{repetitionCount}</span>
              <span className="text-[10px] text-slate-500 block">restarts</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-slate-500 text-[11px] block mb-1">Time Saved</span>
              <span className="text-xl font-bold text-teal-400 font-mono">~{timeSaved}s</span>
              <span className="text-[10px] text-teal-500 block">approved cuts only</span>
            </div>
          </div>
        )}

        {/* Honest transcription state: never show invented words */}
        {analysis && analysis.transcriptionAvailable === false && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-200 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Speech recognition unavailable:</span>{' '}
              {analysis.transcriptionError || 'the Whisper model could not run.'} The transcript is
              empty — no words were invented. Silence detection still ran, so silence cuts are available.
            </div>
          </div>
        )}
        {analysis && analysis.transcriptionAvailable !== false && (project.transcript || []).length === 0 && (
          <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            No speech was detected in this video, so there is no transcript. Silence detection still ran.
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={onReanalyze}
            disabled={isAnalyzing}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Re-run Analysis
          </button>

          <button
            onClick={onProceedToPlan}
            disabled={isAnalyzing || !analysis}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95"
          >
            <span>Review AI Edit Plan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
