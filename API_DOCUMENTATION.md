# ReelCut AI — REST API Documentation

The ReelCut AI backend is built with FastAPI and runs on `http://127.0.0.1:8000`.

## 1. Health Endpoint

### `GET /api/health`
Returns the status and version of the backend service.
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "app": "ReelCut AI",
  "version": "1.0.0"
}
```

---

## 2. Project Management

### `POST /api/projects`
Creates a new project session.
- **Body**: `{ "name": "My Reel Project" }`
- **Response**: `200 OK` returns `ProjectState`

### `GET /api/projects/{project_id}`
Retrieves complete project state including video metadata, analysis, edit plan, transcript, and settings.
- **Response**: `200 OK` returns `ProjectState`

---

## 3. Video Ingestion & Analysis

### `POST /api/projects/{project_id}/upload`
Uploads raw video file (multipart/form-data with field `video`).
- **Validations**: Accepts `.mp4`, `.mov`, `.m4v`, `.webm`.
- **Side effects**: Extracts metadata (resolution, duration, fps, size, audio tracks) and creates keyframe thumbnail.
- **Response**: `200 OK` returns updated `ProjectState`

### `POST /api/projects/{project_id}/analyze`
Triggers full speech and audio cadence analysis:
- Silence intervals (>0.75s)
- Filler words ("um", "uh", "like", "you know")
- Repetitions & false starts
- Timestamped transcript with word-level timings
- Initial proposed edit plan
- **Response**: `200 OK` returns updated `ProjectState`

---

## 4. Edit Plan & Transcript

### `POST /api/projects/{project_id}/edit-plan`
Regenerates the edit plan from current analysis results.
- **Response**: `200 OK` returns `ProjectState`

### `PUT /api/projects/{project_id}/edit-plan`
Updates user decisions (keep / cut) and approval status on proposed suggestions. Automatically updates retained intervals and estimated duration.
- **Body**: `EditPlan`
- **Response**: `200 OK` returns updated `ProjectState`

### `PUT /api/projects/{project_id}/transcript`
Updates transcript segment text and keep/remove status. Re-synchronizes timeline intervals.
- **Body**: `{ "transcript": [TranscriptSegment, ...] }`
- **Response**: `200 OK` returns updated `ProjectState`

---

## 5. Customization Settings

### `PATCH /api/projects/{project_id}/settings`
Updates caption styling, crop framing, title card, or audio fade settings.
- **Body**: `{ "captions": {...}, "crop": {...}, "titleCard": {...}, "audio": {...} }`
- **Response**: `200 OK` returns updated `ProjectState`

### `POST /api/projects/{project_id}/detect-face`
Analyzes keyframe to locate speaker face and returns recommended 9:16 crop window coordinates.
- **Response**: `200 OK` returns `CropSettings`

---

## 6. Rendering & Media Streaming

### `POST /api/projects/{project_id}/render`
Triggers background FFmpeg rendering job.
- **Response**: `200 OK` returns `RenderJob`

### `GET /api/projects/{project_id}/render/{job_id}`
Polls status and live progress of rendering job.
- **Response**: `200 OK` returns `RenderJob` with `progressPercent` and `status` ('rendering' | 'completed' | 'failed')

### `GET /api/media/render/{filename}`
Streams or downloads rendered MP4 video file.
