# ReelCut AI — Video Processing Pipeline

## 1. Pipeline Overview

The ReelCut AI media pipeline is engineered around high-performance native FFmpeg operations, avoiding lossy intermediate re-encodings where possible and producing standards-compliant MP4 reels.

```
Raw Footage (16:9 Landscape)
     │
     ├──> [1] Audio Demuxer & Normalization (pcm_s16le 16kHz)
     │         │
     │         └──> Speech Transcription & Silence Detect (-af silencedetect)
     │
     └──> [2] User Editorial Approval (Cuts approved in Edit Plan)
               │
               ▼
     [3] Filter Complex Graph Construction:
         - Retained Video & Audio Segment Trim (trim, setpts, atrim, asetpts)
         - Concat Stream Synchronization (concat=n=N:v=1:a=1)
         - 9:16 Face-Aware Framing Crop & Scale (crop=w:h:x:y, scale=1080:1920)
         - ASS Kinetic Caption Burning (subtitles='captions.ass')
         - Opening Title Card Overlay (drawbox, drawtext)
         - Audio Fade-in / Fade-out (afade=t=in:st=0:d=..., afade=t=out:...)
               │
               ▼
     [4] MP4 Encoder (H.264 / AAC, faststart, 30fps)
               │
               ▼
     Final Reel (&le; 60 Seconds, 1080x1920 Vertical MP4)
```

## 2. Media Filter Specifications

### A. Cadence & Silence Trimming
- **Filter**: `trim=start=S:end=E,setpts=PTS-STARTPTS`
- Audio matches video boundaries exactly via `atrim=start=S:end=E,asetpts=PTS-STARTPTS` to prevent audio drift.
- Adjacent segments concatenated using `concat=n=N:v=1:a=1` without introducing black frames.

### B. Vertical 9:16 Cropping with Face Centering
- Source is typically 1920x1080 (16:9).
- For 9:16 target aspect ratio:
  ```
  crop_h = src_height / zoom
  crop_w = crop_h * (9 / 16)
  crop_x = clamp((xPercent / 100) * src_width - crop_w / 2, 0, src_width - crop_w)
  crop_y = clamp((yPercent / 100) * src_height - crop_h / 2, 0, src_height - crop_h)
  ```
- Scaled to 1080x1920 with padding to maintain clean crisp output.

### C. Kinetic Subtitles Burning (ASS Substation Alpha)
- Subtitles are generated in ASS format with per-word highlight tags:
  `{\c&H00BBGGRR&}KEYWORD{\c&H00FFFFFF&}`
- Burned directly into the video stream via the `subtitles` filter with CoreText font rendering.

### D. Hook Title Card Overlay
- Overlay box: `drawbox=y=230:color=black@0.65:width=iw:height=220:t=fill:enable='between(t,0,DUR)'`
- Headline text: `drawtext=text='HOOK TITLE':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=270:enable='between(t,0,DUR)'`
- Subtitle text: `drawtext=text='SUBTITLE':fontsize=34:fontcolor=0x14B8A6:x=(w-text_w)/2:y=360:enable='between(t,0,DUR)'`

### E. Audio Fades
- Fade in: `afade=t=in:st=0:d=0.5`
- Fade out: `afade=t=out:st=END-0.8:d=0.8`

### F. Video Encoding Parameters
- **Codec**: `libx264` (Profile: High, CRF: 22, Preset: veryfast)
- **Audio**: `aac` (Bitrate: 192 kbps, Sample rate: 44.1 kHz)
- **Container**: `mp4` with `-movflags +faststart` for instant mobile playback.
