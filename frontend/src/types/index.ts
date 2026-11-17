export type ScreenName =
  | 'upload'
  | 'analysis'
  | 'edit_plan'
  | 'workspace'
  | 'transcript'
  | 'captions'
  | 'crop'
  | 'preview'
  | 'export';

export interface VideoMetadata {
  filename: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
  format: string;
  hasAudio: boolean;
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface WordTiming {
  id: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
  isFiller?: boolean;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  confidence: number;
  isKept: boolean; // true = retained in final video, false = cut
  category?: 'speech' | 'silence' | 'filler' | 'repetition';
  speaker?: string;
}

export interface SilenceInterval {
  id: string;
  start: number;
  end: number;
  duration: number;
  suggestedAction: 'cut' | 'keep';
}

export interface FillerWordMatch {
  id: string;
  word: string;
  start: number;
  end: number;
  segmentId: string;
  confidence: number;
}

export interface RepetitionMatch {
  id: string;
  originalSegmentId: string;
  repeatedSegmentId: string;
  text: string;
  start: number;
  end: number;
  similarity: number;
}

export interface AnalysisResult {
  duration: number;
  silences: SilenceInterval[];
  fillers: FillerWordMatch[];
  repetitions: RepetitionMatch[];
  transcript: TranscriptSegment[];
  speechDuration: number;
  silenceDuration: number;
  estimatedSavingSeconds: number;
  // False when Whisper transcription could not run -- then transcript is
  // empty and the UI must say so instead of showing invented text.
  transcriptionAvailable?: boolean;
  transcriptionError?: string;
}

export interface EditSuggestion {
  id: string;
  type: 'silence' | 'filler' | 'repetition' | 'unnecessary';
  startTime: number;
  endTime: number;
  duration: number;
  transcriptExcerpt: string;
  reason: string;
  confidence: number;
  decision: 'cut' | 'keep';
  approved: boolean; // whether user confirmed
}

export interface TimeInterval {
  start: number;
  end: number;
}

export interface EditPlan {
  projectId: string;
  suggestions: EditSuggestion[];
  retainedIntervals: TimeInterval[];
  originalDuration: number;
  estimatedFinalDuration: number;
  targetMaxDuration: number; // 60s target
  status: 'draft' | 'approved' | 'customized';
}

export interface CaptionSettings {
  enabled: boolean;
  fontFamily: 'Inter' | 'Montserrat' | 'Impact' | 'Cinzel' | 'Fira Code' | 'Arial';
  fontSize: number; // in px or pt
  fontWeight: 'normal' | 'bold' | '800';
  textColor: string; // hex
  highlightColor: string; // hex
  backgroundColor: string; // hex or rgba
  position: 'top' | 'middle' | 'bottom';
  yOffsetPercent: number; // 0 to 100
  wordsPerBatch: number; // 2 to 6
  highlightStyle: 'glow' | 'box' | 'scale' | 'underline';
  showAnimation: boolean;
}

export interface CropSettings {
  aspectRatio: '9:16';
  mode: 'auto_face' | 'manual';
  xPercent: number; // 0 - 100 center point
  yPercent: number;
  zoom: number; // 1.0 to 2.5
  faceDetected: boolean;
  faceConfidence: number;
}

export interface TitleCardSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  durationSeconds: number; // 1 to 5 seconds
  style: 'minimal' | 'bold' | 'gradient' | 'neon';
  textColor: string;
  accentColor: string;
}

export interface AudioSettings {
  fadeInSeconds: number; // 0.1 to 2.0
  fadeOutSeconds: number; // 0.1 to 2.0
  normalize: boolean;
  reduceNoise: boolean;
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata?: VideoMetadata;
  analysis?: AnalysisResult;
  editPlan?: EditPlan;
  transcript: TranscriptSegment[];
  captions: CaptionSettings;
  crop: CropSettings;
  titleCard: TitleCardSettings;
  audio: AudioSettings;
  renderJob?: RenderJob;
}

// Lightweight list entry for the recent-projects picker. hasVideo false
// marks the empty stubs the app used to create on every page load.
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  hasVideo: boolean;
  hasAnalysis: boolean;
  duration?: number | null;
}

export interface RenderJob {
  jobId: string;
  status: 'idle' | 'queued' | 'rendering' | 'completed' | 'failed';
  progressPercent: number;
  currentStep: string;
  outputVideoUrl?: string;
  outputSizeBytes?: number;
  finalDuration?: number;
  // Actual output specs reported by the renderer.
  outputResolution?: string;
  outputFps?: number;
  error?: string;
}

export interface RenderOptions {
  resolution: '1080x1920' | '720x1280';
  fps: 30 | 60;
  qualityPreset: 'high' | 'balanced' | 'compact';
  filename: string;
}

export interface ExportSettings {
  resolution: '1080x1920' | '720x1280';
  fps: 30 | 60;
  bitrateKbps: number;
  filename: string;
  format: 'mp4';
}
