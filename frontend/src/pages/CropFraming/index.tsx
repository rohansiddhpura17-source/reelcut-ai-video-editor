import React, { useState, useEffect, useMemo } from 'react';
import {
  Crop,
  Sparkles,
  Move,
  ZoomIn,
  RotateCcw,
  CheckCircle2,
  ScanFace,
  UserCheck,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ProjectState, CropSettings } from '../../types';

interface CropFramingProps {
  project: ProjectState;
  onUpdateCrop: (crop: CropSettings) => void;
  onDetectFace: () => Promise<CropSettings | null>;
  onNavigateToWorkspace: () => void;
}

export const CropFraming: React.FC<CropFramingProps> = ({
  project,
  onUpdateCrop,
  onDetectFace,
  onNavigateToWorkspace,
}) => {
  const [crop, setCrop] = useState<CropSettings>(project.crop);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [faceError, setFaceError] = useState<string | null>(null);

  const meta = project.metadata;

  // Keep local state in sync when the project updates (e.g. after analysis
  // runs face detection, or a settings save from another screen).
  useEffect(() => {
    setCrop(project.crop);
  }, [project.crop]);

  // Crop-window geometry, computed exactly like the backend's
  // calculate_crop_box: size from zoom, centred on (xPercent, yPercent),
  // clamped to the frame. This makes both sliders move the box for real
  // (the Y slider only has room to move when zoom > 1, because at zoom 1
  // the window already fills the frame height).
  const boxPct = useMemo(() => {
    const srcW = meta?.width || 1920;
    const srcH = meta?.height || 1080;
    const targetAspect = 9 / 16;
    let w: number;
    let h: number;
    if (srcW / srcH > targetAspect) {
      h = srcH / crop.zoom;
      w = h * targetAspect;
    } else {
      w = srcW / crop.zoom;
      h = w / targetAspect;
    }
    w = Math.min(w, srcW);
    h = Math.min(h, srcH);
    const cx = (crop.xPercent / 100) * srcW;
    const cy = (crop.yPercent / 100) * srcH;
    const x = Math.max(0, Math.min(srcW - w, cx - w / 2));
    const y = Math.max(0, Math.min(srcH - h, cy - h / 2));
    return { left: (x / srcW) * 100, top: (y / srcH) * 100, width: (w / srcW) * 100, height: (h / srcH) * 100 };
  }, [crop, meta]);

  const updateSetting = <K extends keyof CropSettings>(key: K, value: CropSettings[K]) => {
    let updated = { ...crop, [key]: value };
    if (key === 'yPercent') {
      // At zoom 1 the 9:16 window already fills the frame height, so the
      // Y slider alone cannot move it (dragging Y used to do nothing
      // visible). Raise zoom just enough for the requested vertical
      // position to take effect, so the box visibly moves, and clamp the
      // value to what is reachable at the (capped) max zoom so the stored
      // yPercent is the one the box actually centres on.
      const raw = value as number;
      const need = minZoomForY(raw);
      let zoom = updated.zoom;
      if (zoom < need) zoom = Math.min(2.5, Math.ceil(need * 20) / 20);
      const h = windowHeightAtZoom(zoom);
      const halfPct = ((h / 2) / (meta?.height || 1080)) * 100;
      const clamped = Math.max(halfPct, Math.min(100 - halfPct, raw));
      updated = { ...updated, yPercent: Math.round(clamped), zoom };
    }
    setCrop(updated);
    onUpdateCrop(updated);
  };

  // Window height (px) at a given zoom, mirroring boxPct / the backend's
  // calculate_crop_box. Landscape source: srcH / zoom. Taller source:
  // srcW / (zoom * targetAspect), capped at the frame height.
  const windowHeightAtZoom = (zoom: number): number => {
    const srcW = meta?.width || 1920;
    const srcH = meta?.height || 1080;
    const targetAspect = 9 / 16;
    if (srcW / srcH > targetAspect) {
      return srcH / zoom;
    }
    return Math.min(srcH, srcW / (zoom * targetAspect));
  };

  // Minimum zoom for a requested vertical centre to be reachable: the
  // window height at that zoom must fit twice the distance from the
  // centre to the nearest frame edge.
  const minZoomForY = (yPercent: number): number => {
    const srcW = meta?.width || 1920;
    const srcH = meta?.height || 1080;
    const targetAspect = 9 / 16;
    const cy = (yPercent / 100) * srcH;
    const edge = Math.min(cy, srcH - cy);
    if (edge <= 0) return 2.5;
    const h1 = srcW / srcH > targetAspect ? srcH : srcW / targetAspect;
    return h1 / (2 * edge);
  };

  const handleRunFaceDetection = async () => {
    setIsDetecting(true);
    setFaceError(null);
    try {
      // Use the real detection result; never fake a face lock.
      const res = await onDetectFace();
      if (res) {
        setCrop((prev) => ({ ...prev, ...res, mode: 'auto_face' }));
      }
    } catch (e) {
      console.error(e);
      setFaceError('Face detection failed. The crop stays centred — adjust framing manually.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleReset = () => {
    const def: CropSettings = {
      aspectRatio: '9:16',
      mode: 'manual',
      xPercent: 50,
      yPercent: 50,
      zoom: 1.0,
      faceDetected: crop.faceDetected,
      faceConfidence: crop.faceConfidence,
    };
    setCrop(def);
    onUpdateCrop(def);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>BSERC Mandate • 9:16 Vertical Framing with Face Centering</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Crop & Speaker Framing Studio
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Converts horizontal 16:9 recordings into vertical 9:16 format while keeping the speaker's face centered.
          </p>
        </div>

        <button
          onClick={onNavigateToWorkspace}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all transform active:scale-95"
        >
          <span>Apply Framing</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Visual Crop Viewport (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <div className="w-full bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-2xl relative">
            <div className="aspect-video bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center">
              {/* Source Video or Placeholder */}
              {meta?.videoUrl ? (
                <video
                  src={meta.videoUrl}
                  className="w-full h-full object-contain opacity-60"
                  muted
                />
              ) : (
                <div className="text-slate-600 text-xs">Original 16:9 Landscape Frame (1920x1080)</div>
              )}

              {/* 9:16 Vertical Crop Window Box: position/size from the same
                  geometry the renderer uses, so the preview matches the export */}
              <div
                className="absolute border-2 border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.3)] bg-teal-500/10 backdrop-blur-[1px] transition-all duration-100 flex flex-col items-center justify-center"
                style={{
                  left: `${boxPct.left}%`,
                  top: `${boxPct.top}%`,
                  width: `${boxPct.width}%`,
                  height: `${boxPct.height}%`,
                }}
              >
                {/* Rule of thirds crosshairs */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-b border-teal-300" />
                  <div className="border-r border-teal-300" />
                  <div className="border-r border-teal-300" />
                </div>

                {/* Face Tracker Target Tag */}
                {crop.mode === 'auto_face' && (
                  <div className="absolute top-1/4 flex flex-col items-center animate-pulse">
                    <ScanFace className="w-8 h-8 text-teal-400" />
                    <span className="text-[9px] font-mono font-bold bg-teal-950/80 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/40 mt-1">
                      {crop.faceDetected
                        ? `FACE LOCKED ${Math.round(crop.faceConfidence * 100)}%`
                        : 'NO FACE — CENTRED CROP'}
                    </span>
                  </div>
                )}

                <span className="absolute bottom-2 text-[10px] font-bold text-teal-300 bg-slate-950/80 px-2 py-0.5 rounded border border-teal-500/30">
                  9:16 Reel Window
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500 px-1">
              <span>Source: {meta?.width || 1920} x {meta?.height || 1080} (16:9)</span>
              <span>Output: 9:16 vertical (resolution set in Export Studio)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Framing Controls & AI Face Tracking (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Face Tracking Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <ScanFace className="w-4 h-4 text-teal-400" />
                <span>AI Face Tracking Engine</span>
              </span>

              <button
                onClick={handleRunFaceDetection}
                disabled={isDetecting}
                className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold border border-teal-500/40 transition-all flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isDetecting ? 'Detecting...' : 'Re-Detect Face'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSetting('mode', 'auto_face')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  crop.mode === 'auto_face'
                    ? 'bg-teal-500/15 border-teal-500/50 text-white'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Auto Face Centering</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Automatically centers the speaker's face in the 9:16 viewport.
                </p>
              </button>

              <button
                onClick={() => updateSetting('mode', 'manual')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  crop.mode === 'manual'
                    ? 'bg-teal-500/15 border-teal-500/50 text-white'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                  <Move className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Manual Framing</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Custom pan and zoom controls for creative framing.
                </p>
              </button>
            </div>

            {faceError && (
              <p className="text-[11px] text-rose-300">{faceError}</p>
            )}
            {crop.mode === 'auto_face' && !crop.faceDetected && !isDetecting && (
              <p className="text-[11px] text-amber-300">
                No face was detected in this video, so the crop is centred. Adjust framing manually below.
              </p>
            )}
          </div>

          {/* Positioning & Zoom Sliders */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-xl">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              Framing Parameters
            </span>

            {/* Horizontal X Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Horizontal Pan (X Axis)</span>
                <span className="font-mono text-white font-bold">{crop.xPercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={crop.xPercent}
                onChange={(e) => updateSetting('xPercent', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            {/* Vertical Y Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Vertical Position (Y Axis)</span>
                <span className="font-mono text-white font-bold">{crop.yPercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={crop.yPercent}
                onChange={(e) => updateSetting('yPercent', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                At 1.00× zoom the window fills the frame height, so moving Y
                zooms in automatically until the frame can move.
              </p>
            </div>

            {/* Zoom Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span className="flex items-center space-x-1">
                  <ZoomIn className="w-3.5 h-3.5 text-teal-400" />
                  <span>Crop Zoom Factor</span>
                </span>
                <span className="font-mono text-white font-bold">{crop.zoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={2.5}
                step={0.05}
                value={crop.zoom}
                onChange={(e) => updateSetting('zoom', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleReset}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Center</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
