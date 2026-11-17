# ReelCut AI

> **Tagline:** Your footage. AI-edited. Your final say.

ReelCut AI is an AI-assisted short-form video editing application built for modern content creators. It ingests raw talking-head footage (typically 3–5 minutes long), analyzes speech cadence to detect long silences, filler words, and repetitive takes, reframes the video to vertical 9:16 with face centering, generates kinetic word-highlighted captions, adds a branded opening title card and audio fades, and exports an engaging reel of 60 seconds or less as a standard MP4.

---

## 🌟 The 5 Mandatory BSERC Requirements

1. **Silence & Filler Removal**: Automatically detects awkward pauses (>0.75s) and verbal crutches ("um", "ah", "like", "you know").
2. **Vertical 9:16 Cropping with Face Tracking**: Reframes horizontal 16:9 recordings into vertical 9:16 while locking onto the speaker's face.
3. **Burn Captions with Highlighted Words**: High-retention kinetic subtitles with active word-by-word color highlighting.
4. **Opening Title Card & Audio Fades**: Styled headline card for the hook and smooth audio fade-in / fade-out transitions.
5. **AI Proposes, You Approve**: Complete edit plan presented before any cuts are applied; user retains full editorial authority.

---

## 🚀 The 4 Additional Core Studios

1. **AI Transcript Editor**: Word-by-word interactive transcript editor with filler highlights, sentence keep/cut toggles, and inline typo correction.
2. **Intelligent Edit Timeline**: Multi-track timeline ruler displaying retained intervals, cut segments, silence markers, and filler-word flags with a scrubbable playhead.
3. **Caption Customization Studio**: Full typography controls (fonts, sizes, colors, background boxes, vertical position, words-per-batch) and curated creator presets (Hormozi, MrBeast, Ali Abdaal).
4. **Export Studio**: Custom output resolution (1080x1920 / 720x1280), framerate (30 / 60 FPS), bitrate presets, live FFmpeg progress tracking, and instant MP4 download.

---

## 🏗️ Technology Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend**: Python 3.13, FastAPI, Uvicorn, Pydantic v2
- **Video Processing**: Native Apple Silicon FFmpeg 9.0 binary (`imageio-ffmpeg`), OpenCV face framing
- **Storage**: Local filesystem storage in `storage/uploads`, `storage/projects`, and `storage/renders`

---

## 🛠️ Quick Start & Local Execution

### 1. Start Backend API Server
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Backend API documentation is available at `http://localhost:8000/docs`.

### 2. Start Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Production Build
```bash
cd frontend
npm run build
```
Production assets are generated in `frontend/dist`.
\n
---

## 👨‍💻 Developer & Contact

**Rohan Siddhpura**  
*B.Tech in Information Technology — RK University*  
- **GitHub:** [@rohansiddhpura17-source](https://github.com/rohansiddhpura17-source)  
- **Email:** [rohansiddhpura17@gmail.com](mailto:rohansiddhpura17@gmail.com)  
- **Open for:** Software Engineering Internships, Graduate Roles & Open-Source Collaboration
