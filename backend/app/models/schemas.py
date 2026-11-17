from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class VideoMetadata(BaseModel):
    filename: str
    duration: float
    width: int
    height: int
    fps: float
    sizeBytes: int
    format: str
    hasAudio: bool
    thumbnailUrl: Optional[str] = None
    videoUrl: Optional[str] = None

class WordTiming(BaseModel):
    id: str
    word: str
    start: float
    end: float
    confidence: float = 0.95
    isFiller: bool = False

class TranscriptSegment(BaseModel):
    id: str
    start: float
    end: float
    text: str
    words: List[WordTiming] = []
    confidence: float = 0.95
    isKept: bool = True
    category: Optional[Literal['speech', 'silence', 'filler', 'repetition']] = 'speech'
    speaker: Optional[str] = 'Speaker 1'

class SilenceInterval(BaseModel):
    id: str
    start: float
    end: float
    duration: float
    suggestedAction: Literal['cut', 'keep'] = 'cut'

class FillerWordMatch(BaseModel):
    id: str
    word: str
    start: float
    end: float
    segmentId: str
    confidence: float = 0.9

class RepetitionMatch(BaseModel):
    id: str
    originalSegmentId: str
    repeatedSegmentId: str
    text: str
    start: float
    end: float
    similarity: float = 0.85

class AnalysisResult(BaseModel):
    duration: float
    silences: List[SilenceInterval] = []
    fillers: List[FillerWordMatch] = []
    repetitions: List[RepetitionMatch] = []
    transcript: List[TranscriptSegment] = []
    speechDuration: float = 0.0
    silenceDuration: float = 0.0
    estimatedSavingSeconds: float = 0.0
    # True when Whisper transcription ran. False when the speech model was
    # unavailable -- then transcript is empty and the UI must say so
    # instead of showing invented text.
    transcriptionAvailable: bool = True
    transcriptionError: Optional[str] = None

class EditSuggestion(BaseModel):
    id: str
    type: Literal['silence', 'filler', 'repetition', 'unnecessary']
    startTime: float
    endTime: float
    duration: float
    transcriptExcerpt: str
    reason: str
    confidence: float = 0.9
    decision: Literal['cut', 'keep'] = 'cut'
    approved: bool = True

class TimeInterval(BaseModel):
    start: float
    end: float

class EditPlan(BaseModel):
    projectId: str
    suggestions: List[EditSuggestion] = []
    retainedIntervals: List[TimeInterval] = []
    originalDuration: float
    estimatedFinalDuration: float
    targetMaxDuration: float = 60.0
    status: Literal['draft', 'approved', 'customized'] = 'draft'

class CaptionSettings(BaseModel):
    enabled: bool = True
    fontFamily: str = 'Inter'
    fontSize: int = 24
    fontWeight: str = 'bold'
    textColor: str = '#FFFFFF'
    highlightColor: str = '#14B8A6'
    backgroundColor: str = 'rgba(0, 0, 0, 0.6)'
    position: Literal['top', 'middle', 'bottom'] = 'bottom'
    yOffsetPercent: int = 75
    wordsPerBatch: int = 4
    highlightStyle: Literal['glow', 'box', 'scale', 'underline'] = 'glow'
    showAnimation: bool = True

class CropSettings(BaseModel):
    aspectRatio: str = '9:16'
    mode: Literal['auto_face', 'manual'] = 'auto_face'
    xPercent: int = 50
    yPercent: int = 50
    zoom: float = 1.0
    # Unknown until face detection runs -- never claim a lock by default.
    faceDetected: bool = False
    faceConfidence: float = 0.0

class TitleCardSettings(BaseModel):
    enabled: bool = True
    title: str = 'ReelCut Highlight'
    subtitle: str = 'AI-Assisted Short Edit'
    durationSeconds: float = 2.0
    style: Literal['minimal', 'bold', 'gradient', 'neon'] = 'gradient'
    textColor: str = '#FFFFFF'
    accentColor: str = '#14B8A6'

class AudioSettings(BaseModel):
    fadeInSeconds: float = 0.5
    fadeOutSeconds: float = 0.8
    normalize: bool = True
    reduceNoise: bool = True

class RenderJob(BaseModel):
    jobId: str
    status: Literal['idle', 'queued', 'rendering', 'completed', 'failed'] = 'idle'
    progressPercent: int = 0
    currentStep: str = 'Initialized'
    outputVideoUrl: Optional[str] = None
    outputSizeBytes: Optional[int] = None
    finalDuration: Optional[float] = None
    # Actual output specs (what the renderer really produced).
    outputResolution: Optional[str] = None
    outputFps: Optional[int] = None
    error: Optional[str] = None

class ProjectState(BaseModel):
    id: str
    name: str = 'Untitled Reel'
    createdAt: str
    updatedAt: str
    metadata: Optional[VideoMetadata] = None
    analysis: Optional[AnalysisResult] = None
    editPlan: Optional[EditPlan] = None
    transcript: List[TranscriptSegment] = []
    captions: CaptionSettings = Field(default_factory=CaptionSettings)
    crop: CropSettings = Field(default_factory=CropSettings)
    titleCard: TitleCardSettings = Field(default_factory=TitleCardSettings)
    audio: AudioSettings = Field(default_factory=AudioSettings)
    renderJob: Optional[RenderJob] = None


class ProjectSummary(BaseModel):
    """Lightweight list entry for the recent-projects picker. Empty
    projects (no video uploaded yet -- e.g. the stubs the app used to
    create on every page load) are flagged so the UI can mark them as
    empty and sort them below real work."""
    id: str
    name: str = 'Untitled Reel'
    createdAt: str = ''
    updatedAt: str = ''
    hasVideo: bool = False
    hasAnalysis: bool = False
    duration: Optional[float] = None
