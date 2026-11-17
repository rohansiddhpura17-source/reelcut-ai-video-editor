import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from ..models.schemas import (
    ProjectState,
    ProjectSummary,
    EditPlan,
    TranscriptSegment,
    CaptionSettings,
    CropSettings,
    TitleCardSettings,
    AudioSettings,
    RenderJob
)
from ..services.video_service import VideoService, sanitize_download_filename
from ..core.config import UPLOADS_DIR, RENDERS_DIR

router = APIRouter(prefix="/api")
service = VideoService()

@router.get("/health")
def health_check():
    return {"status": "ok", "app": "ReelCut AI", "version": "1.0.0"}

@router.post("/projects", response_model=ProjectState)
def create_project(data: Optional[Dict[str, str]] = None):
    name = (data or {}).get("name", "Untitled Reel")
    return service.create_project(name)

# Listed BEFORE /projects/{project_id} so the literal path wins.
@router.get("/projects", response_model=List[ProjectSummary])
def list_projects():
    return service.list_projects()

@router.get("/projects/{project_id}", response_model=ProjectState)
def get_project(project_id: str):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects/{project_id}/upload", response_model=ProjectState)
async def upload_video(project_id: str, video: UploadFile = File(...)):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(video.filename).suffix.lower()
    if ext not in [".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]:
        raise HTTPException(status_code=400, detail="Unsupported video format. Please upload MP4 or MOV.")

    safe_filename = f"{project_id}_{video.filename.replace(' ', '_')}"
    dest_path = UPLOADS_DIR / safe_filename

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    # Extract metadata using FFmpeg
    metadata = service.extract_metadata(str(dest_path))
    project.metadata = metadata
    # A new video is a fresh start: drop the previous video's analysis,
    # edit plan, transcript and render job so nothing stale is shown.
    project.analysis = None
    project.editPlan = None
    project.transcript = []
    project.renderJob = None
    service.save_project(project)

    return project

@router.post("/projects/{project_id}/analyze", response_model=ProjectState)
def analyze_video(project_id: str):
    try:
        return service.analyze_video(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_id}/edit-plan", response_model=ProjectState)
def generate_edit_plan(project_id: str):
    project = service.get_project(project_id)
    if not project or not project.metadata:
        raise HTTPException(status_code=404, detail="Project or video not found")

    service._generate_edit_plan_internal(project)
    service.save_project(project)
    return project

@router.put("/projects/{project_id}/edit-plan", response_model=ProjectState)
def update_edit_plan(project_id: str, edit_plan: EditPlan):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.editPlan = edit_plan

    # Recompute retained intervals
    if project.metadata:
        retained = service.calculate_retained_intervals(
            project.metadata.duration,
            edit_plan.suggestions,
            project.transcript
        )
        project.editPlan.retainedIntervals = retained
        project.editPlan.estimatedFinalDuration = round(sum(iv.end - iv.start for iv in retained), 2)

    service.save_project(project)
    return project

@router.put("/projects/{project_id}/transcript", response_model=ProjectState)
def update_transcript(project_id: str, data: Dict[str, Any]):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    segments_data = data.get("transcript", [])
    project.transcript = [TranscriptSegment(**seg) for seg in segments_data]

    # Re-sync edit plan retained intervals
    if project.metadata and project.editPlan:
        retained = service.calculate_retained_intervals(
            project.metadata.duration,
            project.editPlan.suggestions,
            project.transcript
        )
        project.editPlan.retainedIntervals = retained
        project.editPlan.estimatedFinalDuration = round(sum(iv.end - iv.start for iv in retained), 2)

    service.save_project(project)
    return project

@router.patch("/projects/{project_id}/settings", response_model=ProjectState)
def update_settings(project_id: str, data: Dict[str, Any]):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if "captions" in data:
        project.captions = CaptionSettings(**data["captions"])
    if "crop" in data:
        project.crop = CropSettings(**data["crop"])
    if "titleCard" in data:
        project.titleCard = TitleCardSettings(**data["titleCard"])
    if "audio" in data:
        project.audio = AudioSettings(**data["audio"])

    service.save_project(project)
    return project

@router.post("/projects/{project_id}/detect-face", response_model=CropSettings)
def detect_face(project_id: str):
    project = service.get_project(project_id)
    if not project or not project.metadata:
        raise HTTPException(status_code=404, detail="Project not found")

    video_path = str(UPLOADS_DIR / project.metadata.filename)
    res = service.cropping_processor.detect_face_in_video(
        video_path,
        project.metadata.width,
        project.metadata.height
    )
    project.crop.faceDetected = res.get("faceDetected", False)
    project.crop.faceConfidence = res.get("faceConfidence", 0.0)
    project.crop.xPercent = res.get("xPercent", 50)
    project.crop.yPercent = res.get("yPercent", 50)
    service.save_project(project)
    return project.crop

@router.post("/projects/{project_id}/render", response_model=RenderJob)
def start_render(project_id: str, data: Optional[Dict[str, Any]] = None):
    # Optional render options from the Export page: resolution
    # ('1080x1920' | '720x1280'), fps (30 | 60), qualityPreset
    # ('high' | 'balanced' | 'compact'). Unknown values are ignored by
    # the renderer, which falls back to 1080x1920 / 30fps / balanced.
    try:
        return service.start_render_job(project_id, data or {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/render/{job_id}", response_model=RenderJob)
def get_render_status(project_id: str, job_id: str):
    if job_id in service.active_jobs:
        return service.active_jobs[job_id]
    project = service.get_project(project_id)
    if project and project.renderJob and project.renderJob.jobId == job_id:
        return project.renderJob
    raise HTTPException(status_code=404, detail="Render job not found")

# Media streaming routes
@router.get("/media/thumbnail/{filename}")
def get_thumbnail(filename: str):
    path = UPLOADS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(path, media_type="image/jpeg")

@router.get("/media/video/{filename}")
def get_video(filename: str):
    path = UPLOADS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    return FileResponse(path, media_type="video/mp4")

@router.get("/media/render/{filename}")
def get_rendered_video(filename: str, download_name: Optional[str] = None):
    path = RENDERS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Rendered video not found")
    # The name the download is saved as. The Export page puts the typed
    # filename here (see VideoService._run_render_worker); without it the
    # file falls back to the internal backend filename. The sanitizer
    # strips anything outside [A-Za-z0-9._-], so a crafted value cannot
    # inject a path or a second header.
    served_name = sanitize_download_filename(download_name, filename)
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=served_name,
        headers={"Content-Disposition": f'attachment; filename="{served_name}"'}
    )
