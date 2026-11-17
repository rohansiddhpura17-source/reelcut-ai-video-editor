# ReelCut AI — Project Architecture

## 1. System Overview

ReelCut AI employs a modular, decoupled full-stack architecture designed for high-performance video processing and deterministic user control.

```
+-------------------------------------------------------------+
|                     ReelCut AI Frontend                     |
|           (React 19 + TypeScript + Vite + Tailwind CSS)     |
|  - 9 Stitch Screens: Upload, Analysis, Edit Plan, Workspace,|
|    Transcript Editor, Caption Studio, Crop Framing, Preview,|
|    Export Studio                                            |
|  - Real-time Timeline Scrubbing & Subtitle Preview          |
+------------------------------+------------------------------+
                               | REST API (JSON / FormData)
                               v
+-------------------------------------------------------------+
|                      FastAPI Backend                        |
|       (Python 3.13 + Uvicorn + Pydantic v2 Models)          |
|  - Project State Manager (storage/projects/{id}.json)       |
|  - Media Demuxer, Prober & Streaming Routes                 |
|  - Background Async Render Workers                          |
+------------------------------+------------------------------+
                               | Native Process Pipe
                               v
+-------------------------------------------------------------+
|                Media Engine (FFmpeg 9.0 ARM64)              |
|  - Audio Extraction & Silence Detect (-af silencedetect)    |
|  - Concat Demuxer for Retained Speech Segments              |
|  - 9:16 Vertical Cropping & Face Centering Filter           |
|  - ASS Kinetic Subtitle Burner with Word-Level Color Tags   |
|  - Drawbox / Drawtext Opening Title Card Overlay            |
|  - Audio Fade-in / Fade-out Filter (afade)                  |
|  - Faststart H.264 / AAC MP4 Muxer                          |
+-------------------------------------------------------------+
```

## 2. Directory Structure

```text
/Volumes/PortableSSD/BSERC-WEEK-2/15-One-Minute-Reel-Cut/
├── frontend/
│   ├── src/
│   │   ├── components/layout/Header.tsx
│   │   ├── pages/
│   │   │   ├── UploadVideo/
│   │   │   ├── Analysis/
│   │   │   ├── EditPlan/
│   │   │   ├── EditingWorkspace/
│   │   │   ├── TranscriptEditor/
│   │   │   ├── CaptionStudio/
│   │   │   ├── CropFraming/
│   │   │   ├── Preview/
│   │   │   └── Export/
│   │   ├── services/api.ts
│   │   ├── types/index.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── api/routes.py
│   │   ├── core/config.py
│   │   ├── models/schemas.py
│   │   ├── processors/
│   │   │   ├── silence_detector.py
│   │   │   ├── filler_detector.py
│   │   │   ├── repetition_detector.py
│   │   │   ├── transcription.py
│   │   │   ├── cropping.py
│   │   │   └── renderer.py
│   │   ├── services/video_service.py
│   │   └── main.py
│   ├── venv/
│   └── requirements.txt
├── storage/
│   ├── uploads/
│   ├── projects/
│   └── renders/
├── README.md
├── PROJECT_ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── VIDEO_PROCESSING_PIPELINE.md
├── IMPLEMENTATION_STATUS.md
└── TEST_REPORT.md
```

## 3. Data Flow & State Consistency

1. **Upload**: User drops a raw talking video file. Frontend uploads via multipart POST. Backend extracts stream parameters (duration, width, height, fps) and saves metadata to `storage/projects/{id}.json`.
2. **Cadence Analysis**: Silence detection extracts pauses exceeding 0.75s; transcription engine outputs timestamped word tokens; filler detector flags verbal crutches; repetition detector identifies repeated thoughts.
3. **Editable Edit Plan**: The edit plan calculates proposed cuts and maps retained intervals, verifying that duration does not exceed 60 seconds.
4. **Interactive Timeline & Transcript**: Timeline and Transcript share a single authoritative state in the project model. Any change to a segment's keep/cut status automatically recalculates retained intervals and estimated duration.
5. **Real FFmpeg Rendering**: Approved intervals are piped into FFmpeg to crop to 9:16, burn kinetic subtitles, add opening title cards, apply audio fades, and produce an MP4 under 60 seconds.
