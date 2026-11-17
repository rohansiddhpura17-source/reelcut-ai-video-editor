import React, { useState } from 'react';
import {
  FileText,
  Search,
  Scissors,
  CheckCircle2,
  Sparkles,
  Edit3,
  Repeat,
  VolumeX,
  MessageSquare,
  ArrowRight,
  Filter
} from 'lucide-react';
import { ProjectState, TranscriptSegment } from '../../types';

interface TranscriptEditorProps {
  project: ProjectState;
  onUpdateTranscript: (transcript: TranscriptSegment[]) => void;
  onNavigateToWorkspace: () => void;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  project,
  onUpdateTranscript,
  onNavigateToWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'fillers' | 'repetitions'>('all');

  const transcript = project.transcript || [];

  const handleToggleKeep = (id: string) => {
    const updated = transcript.map((seg) =>
      seg.id === id ? { ...seg, isKept: !seg.isKept } : seg
    );
    onUpdateTranscript(updated);
  };

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditText(seg.text);
  };

  // Words that count as fillers when regenerating word timings after a text edit.
  const FILLER_WORDS = new Set(['um', 'umm', 'uh', 'uhh', 'ah', 'ahh', 'er', 'hmm', 'basically', 'like']);

  const handleSaveEdit = (id: string) => {
    const updated = transcript.map((seg) => {
      if (seg.id !== id) return seg;
      const newText = editText.trim();
      if (newText === seg.text) return seg;
      // Regenerate word timings from the edited text so captions stay in
      // sync with the transcript instead of showing the old words.
      const rawWords = newText.split(/\s+/).filter(Boolean);
      const segDur = Math.max(0.2, seg.end - seg.start);
      const wordDur = segDur / Math.max(1, rawWords.length);
      const words = rawWords.map((w, i) => ({
        id: `${seg.id}_w${i + 1}`,
        word: w,
        start: Math.round((seg.start + i * wordDur) * 100) / 100,
        end: Math.round(Math.min(seg.end, seg.start + (i + 1) * wordDur) * 100) / 100,
        confidence: seg.confidence,
        isFiller: FILLER_WORDS.has(w.toLowerCase().replace(/[.,!?;:"']/g, '')),
      }));
      return { ...seg, text: newText, words };
    });
    onUpdateTranscript(updated);
    setEditingSegmentId(null);
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  const filteredTranscript = transcript.filter((seg) => {
    if (searchQuery && !seg.text.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterMode === 'fillers') {
      return seg.words && seg.words.some((w) => w.isFiller);
    }
    if (filterMode === 'repetitions') {
      return seg.category === 'repetition';
    }
    return true;
  });

  const keptDuration = transcript
    .filter((s) => s.isKept)
    .reduce((acc, s) => acc + (s.end - s.start), 0);

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Transcript Editor • Word-by-Word Control</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Transcript & Cadence Editor
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Cut sentences, remove highlighted filler words, and edit captions directly. Edits automatically sync with the video timeline.
          </p>
        </div>

        {/* Duration Chip */}
        <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center space-x-4">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Kept Speech</span>
            <span
              className={`text-lg font-extrabold font-mono block ${
                keptDuration <= 60 ? 'text-teal-400' : 'text-amber-400'
              }`}
            >
              {keptDuration.toFixed(1)}s
            </span>
          </div>
          <span className="text-xs text-slate-500">(Target &le; 60s)</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spoken words or phrases..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'all'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            All Sentences ({transcript.length})
          </button>
          <button
            onClick={() => setFilterMode('fillers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'fillers'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Has Fillers
          </button>
          <button
            onClick={() => setFilterMode('repetitions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterMode === 'repetitions'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Repetitions ({transcript.filter((s) => s.category === 'repetition').length})
          </button>
        </div>
      </div>

      {/* Transcript Items */}
      <div className="space-y-3 flex-1 overflow-y-auto mb-6 pr-2">
        {filteredTranscript.map((seg) => {
          const isEditing = editingSegmentId === seg.id;
          return (
            <div
              key={seg.id}
              className={`p-4 rounded-xl border transition-all ${
                seg.isKept
                  ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                    {formatSec(seg.start)} &rarr; {formatSec(seg.end)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({(seg.end - seg.start).toFixed(1)}s)
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">{seg.speaker}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleStartEdit(seg)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Edit text"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleKeep(seg.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      seg.isKept
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {seg.isKept ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Keep</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Cut</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Spoken content with word chips */}
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-teal-500/50 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingSegmentId(null)}
                      className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(seg.id)}
                      className="px-3 py-1 rounded bg-teal-500 text-slate-950 font-bold text-xs"
                    >
                      Save Correction
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {seg.words && seg.words.length > 0 ? (
                    seg.words.map((w) => (
                      <span
                        key={w.id}
                        className={`text-xs px-1.5 py-0.5 rounded transition-all ${
                          w.isFiller
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                            : seg.isKept
                            ? 'text-slate-200 hover:bg-slate-800'
                            : 'text-slate-500 line-through'
                        }`}
                        title={`${w.word} (${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s)`}
                      >
                        {w.word}
                      </span>
                    ))
                  ) : (
                    <p
                      className={`text-xs leading-relaxed ${
                        seg.isKept ? 'text-slate-200' : 'text-slate-500 line-through'
                      }`}
                    >
                      {seg.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating CTA */}
      <div className="sticky bottom-0 bg-[#0B0F17]/95 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {transcript.filter((s) => s.isKept).length} of {transcript.length} sentences kept in reel
        </span>
        <button
          onClick={onNavigateToWorkspace}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
        >
          <span>Return to Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
