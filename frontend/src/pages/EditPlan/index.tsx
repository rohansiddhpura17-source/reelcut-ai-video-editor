import React, { useState } from 'react';
import {
  FileCheck2,
  Scissors,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Clock,
  AlertTriangle,
  VolumeX,
  Repeat,
  MessageSquare,
  Filter
} from 'lucide-react';
import { ProjectState, EditSuggestion } from '../../types';
import { capTo60, formatClock } from '../../utils/duration';

interface EditPlanProps {
  project: ProjectState;
  onUpdateSuggestion: (suggestionId: string, decision: 'cut' | 'keep', approved: boolean) => void;
  onApproveAll: () => void;
  onProceedToWorkspace: () => void;
}

export const EditPlanPage: React.FC<EditPlanProps> = ({
  project,
  onUpdateSuggestion,
  onApproveAll,
  onProceedToWorkspace,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const plan = project.editPlan;
  const meta = project.metadata;

  const suggestions = plan?.suggestions || [];
  const filteredSuggestions = suggestions.filter((s) => {
    if (filterType === 'all') return true;
    return s.type === filterType;
  });

  const originalDur = meta?.duration || 0;
  const finalDur = plan?.estimatedFinalDuration || 0;
  const isOver60 = finalDur > 60.0;
  const cap = capTo60(plan?.retainedIntervals || []);

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'silence':
        return <VolumeX className="w-3.5 h-3.5 text-amber-400" />;
      case 'filler':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
      case 'repetition':
        return <Repeat className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Scissors className="w-3.5 h-3.5 text-teal-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>BSERC Mandate • AI Proposes, You Approve</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Proposed AI Edit Plan
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Review proposed cuts before any video is modified. Toggle individual cuts or approve all.
          </p>
        </div>

        {/* Duration Bar & Target Chip */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center space-x-6">
          <div>
            <span className="text-[11px] text-slate-500 block">Original</span>
            <span className="text-base font-bold text-slate-300 font-mono">{formatSec(originalDur)}</span>
          </div>
          <div className="w-6 h-[1px] bg-slate-700" />
          <div>
            <span className="text-[11px] text-slate-500 block">Proposed Reel</span>
            <span
              className={`text-lg font-extrabold font-mono ${
                isOver60 ? 'text-amber-400' : 'text-teal-400'
              }`}
            >
              {formatSec(finalDur)}
            </span>
          </div>

          <div
            className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
              isOver60
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
            }`}
          >
            {isOver60 ? 'Exceeds 60s Target' : 'Within 60s Reel Limit'}
          </div>
        </div>
      </div>

      {/* Warning if over 60s: the export keeps only the first 60s */}
      {isOver60 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">ReelCut Duration Advisory:</span> Current approved cuts leave{' '}
            {finalDur.toFixed(1)}s of video. The target is 60 seconds or less — and the export keeps only the
            first 60s of the retained footage. The following kept content will NOT appear in the final reel:{' '}
            {cap.dropped.length > 0
              ? cap.dropped.map((iv) => `${formatClock(iv.start)}–${formatClock(iv.end)} (${(iv.end - iv.start).toFixed(1)}s)`).join(', ')
              : 'none (retained footage already fits).'}{' '}
            Select additional sentences in the Transcript Editor or approve more silence removals to reach the
            60s threshold without cutting complete ideas.
          </div>
        </div>
      )}

      {/* Filter and Bulk Action Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 flex items-center space-x-1 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {['all', 'silence', 'filler', 'repetition'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filterType === t
                  ? 'bg-slate-800 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t} ({t === 'all' ? suggestions.length : suggestions.filter((s) => s.type === t).length})
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onApproveAll}
            className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-xs font-medium border border-teal-500/30 transition-all"
          >
            Approve All Proposed Cuts
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-3 flex-1 overflow-y-auto mb-6 pr-2">
        {filteredSuggestions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No suggestions match the selected filter.
          </div>
        ) : (
          filteredSuggestions.map((sug) => {
            const isCut = sug.decision === 'cut' && sug.approved;
            return (
              <div
                key={sug.id}
                className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                  isCut
                    ? 'bg-slate-900/60 border-slate-800'
                    : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start space-x-3 max-w-2xl">
                  <div className="p-2 rounded-lg bg-slate-800/80 mt-0.5">
                    {getTypeIcon(sug.type)}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-semibold text-white capitalize">{sug.type}</span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {formatSec(sug.startTime)} &rarr; {formatSec(sug.endTime)} ({sug.duration.toFixed(1)}s)
                      </span>
                      <span className="text-[10px] text-teal-400 bg-teal-950/60 px-1.5 py-0.5 rounded">
                        {Math.round(sug.confidence * 100)}% match
                      </span>
                    </div>

                    <p className="text-slate-300 text-xs italic font-serif">"{sug.transcriptExcerpt}"</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{sug.reason}</p>
                  </div>
                </div>

                {/* Keep / Cut Toggle Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateSuggestion(sug.id, 'cut', true)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isCut
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cut</span>
                  </button>

                  <button
                    onClick={() => onUpdateSuggestion(sug.id, 'keep', false)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !isCut
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Keep</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Floating Bar */}
      <div className="sticky bottom-0 bg-[#0B0F17]/95 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          <span>{suggestions.filter((s) => s.decision === 'cut' && s.approved).length} cuts approved</span>
          <span className="mx-2">•</span>
          <span>Final Reel: ~{finalDur.toFixed(1)}s{isOver60 ? ' planned → 60.0s exported (capped)' : ''}</span>
        </div>

        <button
          onClick={onProceedToWorkspace}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
        >
          <span>Open Main Editing Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
