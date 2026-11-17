import json
import os
import re
import subprocess
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from urllib.parse import quote

from ..core.config import (
    STORAGE_DIR,
    UPLOADS_DIR,
    PROJECTS_DIR,
    RENDERS_DIR,
    FFMPEG_BIN
)
from ..models.schemas import (
    ProjectState,
    ProjectSummary,
    VideoMetadata,
    AnalysisResult,
    EditPlan,
    EditSuggestion,
    TimeInterval,
    TranscriptSegment,
    RenderJob,
    CaptionSettings,
    CropSettings,
    TitleCardSettings,
    AudioSettings
)
from ..processors.silence_detector import SilenceDetector
from ..processors.filler_detector import FillerDetector
from ..processors.repetition_detector import RepetitionDetector
from ..processors.transcription import TranscriptionEngine, TranscriptionUnavailableError
from ..processors.cropping import CroppingProcessor
from ..processors.renderer import VideoRenderer


def sanitize_download_filename(raw: Optional[str], fallback: str) -> str:
    """
    Sanitizes a user-typed export filename (same rule as the Export page):
    only [A-Za-z0-9._-] survives, everything else becomes '_', and the
    name must end in .mp4. Returns the fallback when nothing usable remains.
    This is what the download is named on disk, so the backend's internal
    render filename ({project_id}_reel_cut.mp4) can never leak into a
    download as a competing filename.
    """
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (raw or "").strip()) or fallback
    return safe if safe.lower().endswith(".mp4") else f"{safe}.mp4"


class VideoService:
    def __init__(self):
        self.silence_detector = SilenceDetector()
        self.filler_detector = FillerDetector()
        self.repetition_detector = RepetitionDetector()
        self.transcription_engine = TranscriptionEngine()
        self.cropping_processor = CroppingProcessor()
        self.renderer = VideoRenderer()
        self.active_jobs: Dict[str, RenderJob] = {}

    def _get_project_file(self, project_id: str) -> Path:
        return PROJECTS_DIR / f"{project_id}.json"

    def save_project(self, project: ProjectState):
        file_path = self._get_project_file(project.id)
        project.updatedAt = datetime.utcnow().isoformat()
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(project.model_dump_json(indent=2))

    def get_project(self, project_id: str) -> Optional[ProjectState]:
        file_path = self._get_project_file(project_id)
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return ProjectState(**data)

    def list_projects(self) -> List[ProjectSummary]:
        """Summaries of every stored project, newest real work first.
        Projects with a video sort above empty stubs; unreadable files
        are skipped, never fatal."""
        summaries: List[ProjectSummary] = []
        for file_path in PROJECTS_DIR.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                meta = data.get("metadata") or {}
                summaries.append(ProjectSummary(
                    id=data.get("id", file_path.stem),
                    name=data.get("name", "Untitled Reel"),
                    createdAt=data.get("createdAt", ""),
                    updatedAt=data.get("updatedAt", ""),
                    hasVideo=bool(data.get("metadata")),
                    hasAnalysis=bool(data.get("analysis")),
                    duration=meta.get("duration") if isinstance(meta, dict) else None,
                ))
            except Exception as e:
                print(f"Skipping unreadable project file {file_path}: {e}")
        # Video projects first, then empty stubs; newest first in each group.
        summaries.sort(key=lambda s: (s.hasVideo, s.updatedAt), reverse=True)
        return summaries

    def create_project(self, name: str = "Untitled Reel") -> ProjectState:
        project_id = str(uuid.uuid4())[:8]
        now = datetime.utcnow().isoformat()
        project = ProjectState(
            id=project_id,
            name=name,
            createdAt=now,
            updatedAt=now
        )
        self.save_project(project)
        return project

    def extract_metadata(self, video_path: str) -> VideoMetadata:
        """
        Uses FFmpeg to probe video stream metadata and generate thumbnail.
        """
        cmd = [FFMPEG_BIN, "-i", str(video_path)]
        res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, check=False)
        output = res.stderr

        # Extract duration
        duration = 0.0
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", output)
        if dur_match:
            h, m, s = float(dur_match.group(1)), float(dur_match.group(2)), float(dur_match.group(3))
            duration = h * 3600 + m * 60 + s

        # Extract resolution
        width, height = 1920, 1080
        res_match = re.search(r"Video:.*,\s*(\d{3,4})x(\d{3,4})", output)
        if res_match:
            width = int(res_match.group(1))
            height = int(res_match.group(2))

        # Extract FPS
        fps = 30.0
        fps_match = re.search(r"(\d+(?:\.\d+)?)\s*fps", output)
        if fps_match:
            fps = float(fps_match.group(1))

        # Check audio
        has_audio = "Audio:" in output

        # File size
        size_bytes = os.path.getsize(video_path)

        # Generate thumbnail at 1s mark
        filename = Path(video_path).stem
        thumb_filename = f"{filename}_thumb.jpg"
        thumb_path = UPLOADS_DIR / thumb_filename
        thumb_cmd = [
            FFMPEG_BIN,
            "-y",
            "-ss", str(min(1.0, duration / 2)),
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            str(thumb_path)
        ]
        subprocess.run(thumb_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)

        return VideoMetadata(
            filename=Path(video_path).name,
            duration=round(duration, 2),
            width=width,
            height=height,
            fps=round(fps, 2),
            sizeBytes=size_bytes,
            format=Path(video_path).suffix.lstrip(".").lower() or "mp4",
            hasAudio=has_audio,
            thumbnailUrl=f"/api/media/thumbnail/{thumb_filename}",
            videoUrl=f"/api/media/video/{Path(video_path).name}"
        )

    def analyze_video(self, project_id: str) -> ProjectState:
        project = self.get_project(project_id)
        if not project or not project.metadata:
            raise ValueError("Project or video metadata not found")

        video_path = UPLOADS_DIR / project.metadata.filename
        dur = project.metadata.duration

        # 1. Transcribe speech with Whisper. If the model is unavailable,
        # report it honestly -- never invent transcript text.
        transcription_available = True
        transcription_error = None
        try:
            transcript = self.transcription_engine.transcribe(str(video_path), dur)
        except TranscriptionUnavailableError as e:
            print(f"Transcription unavailable for {project_id}: {e}")
            transcript = []
            transcription_available = False
            transcription_error = str(e)
        project.transcript = transcript

        # 2. Detect silences
        silences = self.silence_detector.detect_silences(str(video_path))

        # 3. Detect fillers (runs on the real transcript)
        fillers = self.filler_detector.detect_in_transcript(transcript)

        # 4. Detect repetitions (runs on the real transcript)
        repetitions = self.repetition_detector.detect_repetitions(transcript)

        # 5. Detect the speaker's face for the 9:16 crop. Failure here must
        # not fail the analysis -- faceDetected simply stays False.
        try:
            face = self.cropping_processor.detect_face_in_video(
                str(video_path), project.metadata.width, project.metadata.height
            )
            project.crop.faceDetected = face.get("faceDetected", False)
            project.crop.faceConfidence = face.get("faceConfidence", 0.0)
            project.crop.xPercent = face.get("xPercent", 50)
            project.crop.yPercent = face.get("yPercent", 50)
        except Exception as e:
            print(f"Face detection failed during analysis: {e}")
            project.crop.faceDetected = False
            project.crop.faceConfidence = 0.0

        # Compute statistics
        silence_total = sum(s.duration for s in silences)
        speech_total = max(0.0, dur - silence_total)

        project.analysis = AnalysisResult(
            duration=dur,
            silences=silences,
            fillers=fillers,
            repetitions=repetitions,
            transcript=transcript,
            speechDuration=round(speech_total, 2),
            silenceDuration=round(silence_total, 2),
            estimatedSavingSeconds=0.0,
            transcriptionAvailable=transcription_available,
            transcriptionError=transcription_error
        )

        # Automatically generate initial edit plan
        self._generate_edit_plan_internal(project)

        # Time Saved counts ONLY the approved cuts in the plan:
        # original duration minus the retained (post-cut) duration.
        # It must not count silences the plan keeps.
        if project.editPlan:
            project.analysis.estimatedSavingSeconds = round(
                max(0.0, dur - project.editPlan.estimatedFinalDuration), 1
            )

        self.save_project(project)
        return project

    def _generate_edit_plan_internal(self, project: ProjectState):
        if not project.analysis:
            return

        suggestions: List[EditSuggestion] = []
        sug_idx = 1

        # Suggest cutting long silences.
        # One rule, used everywhere (detector, plan, UI copy): silences
        # >= 0.75s are detected and shown; only silences >= 1.0s are
        # proposed as cuts (the detector already marks those 'cut').
        for s in project.analysis.silences:
            if s.suggestedAction == 'cut' and s.duration >= 1.0:
                suggestions.append(
                    EditSuggestion(
                        id=f"sug_{sug_idx}",
                        type="silence",
                        startTime=s.start,
                        endTime=s.end,
                        duration=s.duration,
                        transcriptExcerpt="[Silence / Dead Air]",
                        reason=f"Remove awkward {s.duration}s pause to maintain viewer engagement",
                        confidence=0.96,
                        decision="cut",
                        approved=True
                    )
                )
                sug_idx += 1

        # Suggest cutting fillers
        for f in project.analysis.fillers:
            suggestions.append(
                EditSuggestion(
                    id=f"sug_{sug_idx}",
                    type="filler",
                    startTime=f.start,
                    endTime=f.end,
                    duration=round(f.end - f.start, 2),
                    transcriptExcerpt=f"Filler word: '{f.word}'",
                    reason=f"Remove verbal crutch '{f.word}' for crisp delivery",
                    confidence=f.confidence,
                    decision="cut",
                    approved=True
                )
            )
            sug_idx += 1

        # Suggest cutting repeated sentences
        for r in project.analysis.repetitions:
            suggestions.append(
                EditSuggestion(
                    id=f"sug_{sug_idx}",
                    type="repetition",
                    startTime=r.start,
                    endTime=r.end,
                    duration=round(r.end - r.start, 2),
                    transcriptExcerpt=r.text[:60] + "...",
                    reason=f"Remove repeated thought ({int(r.similarity * 100)}% match)",
                    confidence=0.9,
                    decision="cut",
                    approved=True
                )
            )
            sug_idx += 1

        # Calculate retained intervals
        retained = self.calculate_retained_intervals(
            project.metadata.duration,
            suggestions,
            project.transcript
        )

        estimated_dur = sum(iv.end - iv.start for iv in retained)

        project.editPlan = EditPlan(
            projectId=project.id,
            suggestions=suggestions,
            retainedIntervals=retained,
            originalDuration=project.metadata.duration,
            estimatedFinalDuration=round(estimated_dur, 2),
            targetMaxDuration=60.0,
            status="draft"
        )

    def calculate_retained_intervals(
        self,
        total_duration: float,
        suggestions: List[EditSuggestion],
        transcript: List[TranscriptSegment]
    ) -> List[TimeInterval]:
        """
        Calculates non-overlapping retained intervals based on approved cuts and transcript decisions.
        """
        # Collect cut intervals from approved suggestions
        cuts = []
        for s in suggestions:
            if s.decision == "cut" and s.approved:
                cuts.append((s.startTime, s.endTime))

        # Also check transcript segments marked not kept
        for seg in transcript:
            if not seg.isKept:
                cuts.append((seg.start, seg.end))

        # Sort and merge overlapping cut intervals
        cuts.sort(key=lambda x: x[0])
        merged_cuts = []
        for start, end in cuts:
            if not merged_cuts:
                merged_cuts.append([start, end])
            else:
                last = merged_cuts[-1]
                if start <= last[1]:
                    last[1] = max(last[1], end)
                else:
                    merged_cuts.append([start, end])

        # Invert cuts to compute retained intervals
        retained: List[TimeInterval] = []
        cur_time = 0.0
        for cut_start, cut_end in merged_cuts:
            if cut_start > cur_time + 0.1:
                retained.append(TimeInterval(start=round(cur_time, 2), end=round(cut_start, 2)))
            cur_time = max(cur_time, cut_end)

        if total_duration > cur_time + 0.1:
            retained.append(TimeInterval(start=round(cur_time, 2), end=round(total_duration, 2)))

        return retained

    def start_render_job(self, project_id: str, render_options: Optional[Dict[str, Any]] = None) -> RenderJob:
        project = self.get_project(project_id)
        if not project or not project.metadata:
            raise ValueError("Project not found")

        job_id = f"job_{uuid.uuid4().hex[:8]}"
        job = RenderJob(
            jobId=job_id,
            status="rendering",
            progressPercent=5,
            currentStep="Initializing FFmpeg render pipeline"
        )
        self.active_jobs[job_id] = job
        project.renderJob = job
        self.save_project(project)

        # Run render in background thread
        thread = threading.Thread(
            target=self._run_render_worker,
            args=(project, job_id, render_options or {}),
            daemon=True
        )
        thread.start()

        return job

    def _run_render_worker(self, project: ProjectState, job_id: str, render_options: Dict[str, Any]):
        job = self.active_jobs[job_id]
        try:
            source_path = str(UPLOADS_DIR / project.metadata.filename)
            output_filename = f"{project.id}_reel_cut.mp4"
            output_path = str(RENDERS_DIR / output_filename)

            def on_progress(pct: int, step: str):
                job.progressPercent = pct
                job.currentStep = step
                project.renderJob = job
                self.save_project(project)

            result = self.renderer.render(
                project=project,
                source_video_path=source_path,
                output_mp4_path=output_path,
                progress_callback=on_progress,
                render_options=render_options
            )

            job.status = "completed"
            job.progressPercent = 100
            job.currentStep = "Render complete"
            # The file on disk keeps the stable internal name
            # ({project_id}_reel_cut.mp4), but the download is named after
            # the typed filename from the Export page: it travels as a
            # download_name query param, and the media route turns it into
            # the Content-Disposition filename. That way every download
            # path — the blob download, its direct-URL fallback, and the
            # Share Link — all produce the typed name, never the internal
            # backend filename.
            download_name = sanitize_download_filename(
                render_options.get("filename"), output_filename
            )
            job.outputVideoUrl = (
                f"/api/media/render/{output_filename}"
                f"?download_name={quote(download_name)}"
            )
            job.outputSizeBytes = result.get("fileSizeBytes")
            job.finalDuration = result.get("duration")
            job.outputResolution = result.get("resolution")
            job.outputFps = result.get("fps")
            project.renderJob = job
            self.save_project(project)

        except Exception as e:
            print(f"Render failed for job {job_id}: {e}")
            job.status = "failed"
            job.error = str(e)
            job.currentStep = f"Error: {e}"
            project.renderJob = job
            self.save_project(project)
