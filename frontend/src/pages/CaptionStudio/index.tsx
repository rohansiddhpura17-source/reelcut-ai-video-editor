import React, { useState, useEffect } from 'react';
import {
  Type,
  Sparkles,
  Sliders,
  Palette,
  Eye,
  Check,
  ArrowRight,
  MoveVertical,
  Wand2
} from 'lucide-react';
import { ProjectState, CaptionSettings } from '../../types';

interface CaptionStudioProps {
  project: ProjectState;
  onUpdateCaptions: (settings: CaptionSettings) => void;
  onNavigateToWorkspace: () => void;
}

export const CaptionStudio: React.FC<CaptionStudioProps> = ({
  project,
  onUpdateCaptions,
  onNavigateToWorkspace,
}) => {
  const [captions, setCaptions] = useState<CaptionSettings>(project.captions);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(1);

  // Keep local state in sync when the project updates (e.g. after analysis
  // or a settings save from another screen).
  useEffect(() => {
    setCaptions(project.captions);
  }, [project.captions]);

  const previewWords = ['YOUR', 'FOOTAGE', 'AI-EDITED', 'YOUR', 'FINAL', 'SAY'];

  const presets = [
    {
      name: 'Hormozi Neon',
      fontFamily: 'Impact' as const,
      fontSize: 28,
      fontWeight: '800' as const,
      textColor: '#FFFFFF',
      highlightColor: '#FACC15', // Neon yellow
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      wordsPerBatch: 3,
      highlightStyle: 'glow' as const,
    },
    {
      name: 'MrBeast Pop',
      fontFamily: 'Montserrat' as const,
      fontSize: 26,
      fontWeight: '800' as const,
      textColor: '#FFFFFF',
      highlightColor: '#2DD4BF', // Teal neon
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      wordsPerBatch: 4,
      highlightStyle: 'box' as const,
    },
    {
      name: 'Ali Abdaal Minimal',
      fontFamily: 'Inter' as const,
      fontSize: 22,
      fontWeight: 'bold' as const,
      textColor: '#F8FAFC',
      highlightColor: '#6366F1', // Indigo
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      wordsPerBatch: 5,
      highlightStyle: 'scale' as const,
    },
    {
      name: 'Cinematic Sub',
      fontFamily: 'Cinzel' as const,
      fontSize: 20,
      fontWeight: 'normal' as const,
      textColor: '#E2E8F0',
      highlightColor: '#F59E0B', // Amber
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      wordsPerBatch: 4,
      highlightStyle: 'underline' as const,
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    const updated: CaptionSettings = {
      ...captions,
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      textColor: preset.textColor,
      highlightColor: preset.highlightColor,
      backgroundColor: preset.backgroundColor,
      wordsPerBatch: preset.wordsPerBatch,
      highlightStyle: preset.highlightStyle,
    };
    setCaptions(updated);
    onUpdateCaptions(updated);
  };

  const updateSetting = <K extends keyof CaptionSettings>(key: K, value: CaptionSettings[K]) => {
    const updated = { ...captions, [key]: value };
    setCaptions(updated);
    onUpdateCaptions(updated);
  };

  // The background may be rgba(...) (from presets); the colour input needs hex.
  const backgroundHex = (() => {
    const m = captions.backgroundColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`;
    }
    return captions.backgroundColor.startsWith('#') ? captions.backgroundColor : '#000000';
  })();

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Caption Customization Studio • Kinetic Styling</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Captions & Kinetic Word Highlights
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Burn stylized animated captions into the final reel. Custom typography, word-level color pop, and vertical positioning.
          </p>
        </div>

        <button
          onClick={onNavigateToWorkspace}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
        >
          <span>Save & Apply Captions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Preset Cards & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Presets */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Wand2 className="w-3.5 h-3.5 text-teal-400" />
              <span>Curated Caption Presets</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              {presets.map((p) => {
                const isActive = captions.fontFamily === p.fontFamily && captions.highlightColor === p.highlightColor;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative ${
                      isActive
                        ? 'bg-teal-500/15 border-teal-500/50 shadow-md shadow-teal-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-white text-xs">{p.name}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-teal-400" />}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                      <span>{p.fontFamily}</span>
                      <span>•</span>
                      <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: p.highlightColor }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography & Styling Controls */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Typography & Appearance
            </span>

            {/* Font Family */}
            <div className="grid grid-cols-3 gap-2">
              {['Inter', 'Montserrat', 'Impact', 'Cinzel', 'Fira Code', 'Arial'].map((font) => (
                <button
                  key={font}
                  onClick={() => updateSetting('fontFamily', font as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    captions.fontFamily === font
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
            </div>

            {/* Sliders: Size & Words per Batch */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Font Size</span>
                  <span className="font-mono text-white font-bold">{captions.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={40}
                  value={captions.fontSize}
                  onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Words Per Batch</span>
                  <span className="font-mono text-white font-bold">{captions.wordsPerBatch} words</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={captions.wordsPerBatch}
                  onChange={(e) => updateSetting('wordsPerBatch', Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs text-slate-400 block mb-2">Base Text Color</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={captions.textColor}
                    onChange={(e) => updateSetting('textColor', e.target.value)}
                    className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-slate-300 uppercase">{captions.textColor}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-2">Active Word Highlight Color</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={captions.highlightColor}
                    onChange={(e) => updateSetting('highlightColor', e.target.value)}
                    className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs text-slate-300 uppercase">{captions.highlightColor}</span>
                </div>
              </div>
            </div>

            {/* Highlight Style / Font Weight / Background: these reach the renderer */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs text-slate-400 block mb-2">Highlight Style</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['glow', 'box', 'scale', 'underline'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSetting('highlightStyle', s)}
                      className={`px-2.5 py-1.5 rounded-lg capitalize text-xs font-medium border transition-all ${
                        captions.highlightStyle === s
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-2">Font Weight</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['normal', 'bold', '800'] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => updateSetting('fontWeight', w)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        captions.fontWeight === w
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {w === '800' ? 'Extra Bold' : w === 'bold' ? 'Bold' : 'Normal'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 block mb-2">Caption Background</span>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={backgroundHex}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-xs text-slate-300">{captions.backgroundColor}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Picking a colour sets an opaque background; presets use a translucent black.</p>
            </div>

            {/* Vertical Position Slider */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span className="flex items-center space-x-1">
                  <MoveVertical className="w-3.5 h-3.5 text-teal-400" />
                  <span>Vertical Screen Position</span>
                </span>
                <span className="font-mono text-white font-bold">{captions.yOffsetPercent}% from top</span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                value={captions.yOffsetPercent}
                onChange={(e) => updateSetting('yOffsetPercent', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live 9:16 Kinetic Preview Stage (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>Interactive 9:16 Caption Preview</span>
          </span>

          {/* 9:16 Canvas Box */}
          <div className="w-full max-w-[320px] aspect-[9/16] bg-slate-950 rounded-2xl border-2 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-6">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-950/80 pointer-events-none" />

            {/* Simulated Speaker Silhouette */}
            <div className="w-28 h-28 rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-600 mb-6">
              <span className="text-xs">Speaker Frame</span>
            </div>

            {/* Kinetic Caption Simulation */}
            <div
              className="absolute inset-x-4 text-center transition-all duration-150"
              style={{
                top: `${captions.yOffsetPercent}%`,
                transform: 'translateY(-50%)',
              }}
            >
              <div
                className="inline-block px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md"
                style={{
                  backgroundColor: captions.backgroundColor,
                  fontFamily: captions.fontFamily,
                }}
              >
                <p
                  className="font-extrabold uppercase tracking-wide leading-tight drop-shadow-md"
                  style={{
                    fontSize: `${captions.fontSize}px`,
                    color: captions.textColor,
                  }}
                >
                  {previewWords.slice(0, captions.wordsPerBatch).map((word, idx) => {
                    const isHighlighted = idx === activeWordIdx;
                    return (
                      <span
                        key={idx}
                        onClick={() => setActiveWordIdx(idx)}
                        className={`mx-1 cursor-pointer transition-transform inline-block ${
                          isHighlighted ? 'scale-110 drop-shadow-lg font-black' : 'opacity-85'
                        }`}
                        style={{
                          color: isHighlighted ? captions.highlightColor : captions.textColor,
                        }}
                      >
                        {word}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>

            {/* Test Word Animator Button */}
            <div className="absolute bottom-4 inset-x-4 flex justify-center">
              <button
                onClick={() =>
                  setActiveWordIdx((prev) => (prev + 1) % captions.wordsPerBatch)
                }
                className="px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-teal-300 text-[11px] font-semibold transition-all"
              >
                Simulate Next Spoken Word &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
