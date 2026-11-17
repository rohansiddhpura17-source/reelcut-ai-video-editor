import React from 'react';
import {
  Upload,
  Cpu,
  FileCheck2,
  LayoutDashboard,
  FileText,
  Type,
  Crop,
  Eye,
  Download,
  Scissors,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ScreenName } from '../../types';

interface HeaderProps {
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  projectName: string;
  originalDuration?: number;
  finalDuration?: number;
  hasVideo: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  projectName,
  originalDuration = 0,
  finalDuration = 0,
  hasVideo
}) => {
  const screens: { id: ScreenName; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { id: 'analysis', label: 'AI Analysis', icon: <Cpu className="w-4 h-4" /> },
    { id: 'edit_plan', label: 'Edit Plan', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'workspace', label: 'Workspace', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'transcript', label: 'Transcript', icon: <FileText className="w-4 h-4" /> },
    { id: 'captions', label: 'Captions', icon: <Type className="w-4 h-4" /> },
    { id: 'crop', label: 'Crop 9:16', icon: <Crop className="w-4 h-4" /> },
    { id: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
    { id: 'export', label: 'Export', icon: <Download className="w-4 h-4" /> },
  ];

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-[#0B0F17]/90 backdrop-blur-md px-4 flex items-center z-40 select-none gap-3">
      {/* Brand & Project Name */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('upload')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold tracking-tight text-white text-base">ReelCut</span>
            <span className="text-teal-400 font-semibold text-xs ml-1 px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-500/30">AI</span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span className="font-medium text-slate-200 truncate max-w-[100px] xl:max-w-[140px]">{projectName}</span>
          {hasVideo && (
            <div className="hidden lg:flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-[11px]">
              <span className="text-slate-400">{formatSec(originalDuration)}</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className={`font-semibold ${finalDuration <= 60 ? 'text-teal-400' : 'text-amber-400'}`}>
                {formatSec(finalDuration)}
              </span>
              <span className="text-[10px] text-slate-500">(Target: &le;60s)</span>
            </div>
          )}
        </div>
      </div>

      {/* Screen Navigation Tabs: takes the remaining width and scrolls
          horizontally, so all 9 tabs stay reachable at ~1280px wide */}
      <nav className="flex flex-1 min-w-0 items-center space-x-1 overflow-x-auto py-1 scrollbar-none [mask-image:linear-gradient(to_right,black_92%,transparent)]">
        {screens.map((s) => {
          const isActive = currentScreen === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {s.icon}
              <span className="hidden md:inline">{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Action CTA */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => onNavigate('export')}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white shadow-md shadow-teal-500/20 transition-all active:scale-95 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Export Reel</span>
        </button>
      </div>
    </header>
  );
};
