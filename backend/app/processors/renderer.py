import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import List, Callable, Optional
from ..core.config import FFMPEG_BIN, RENDERS_DIR
from ..models.schemas import (
    ProjectState,
    TimeInterval,
    CaptionSettings,
    TitleCardSettings,
    AudioSettings,
    CropSettings
)
from .cropping import CroppingProcessor

class VideoRenderer:
    def __init__(self):
        self.cropper = CroppingProcessor()

    @staticmethod
    def _color_to_ass(color_str: str, default_alpha: int = 0x00) -> str:
        """
        Hex (#RRGGBB) or rgba(r, g, b, a) -> ASS colour &HAABBGGRR&.
        ASS alpha is inverted: 00 = opaque, FF = fully transparent.
        """
        s = (color_str or "").strip()
        m = re.match(
            r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)", s
        )
        if m:
            r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
            a = float(m.group(4)) if m.group(4) is not None else 1.0
            alpha = int(round((1.0 - a) * 255))
            return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}&"
        hex_clean = s.lstrip("#")
        if len(hex_clean) == 6:
            r, g, b = hex_clean[0:2], hex_clean[2:4], hex_clean[4:6]
            return f"&H{default_alpha:02X}{b}{g}{r}&"
        return f"&H{default_alpha:02X}FFFFFF&"

    @staticmethod
    def _style_highlighted_word(word: str, style: str, highlight_ass_color: str) -> str:
        """Wraps a highlighted word in ASS overrides for the chosen style."""
        if style == "box":
            # Thick outline in the highlight colour reads as a highlight box.
            return r"{\bord3\3c" + highlight_ass_color + r"}" + word + r"{\r}"
        if style == "scale":
            return r"{\fscx125\fscy125\c" + highlight_ass_color + r"}" + word + r"{\r}"
        if style == "underline":
            return r"{\u1\c" + highlight_ass_color + r"}" + word + r"{\r}"
        # 'glow' (default): highlight colour, the style outline gives the glow.
        return r"{\c" + highlight_ass_color + r"}" + word + r"{\r}"

    def generate_ass_subtitles(
        self,
        project: ProjectState,
        ass_path: str,
        time_offset_map: List[tuple],
        out_width: int = 1080,
        out_height: int = 1920
    ):
        """
        Generates an Advanced SubStation Alpha (.ass) subtitle file
        with word-level highlight colors and customized font styles.
        Honours the caption settings: fontFamily, fontSize, fontWeight,
        textColor, highlightColor, backgroundColor, highlightStyle and
        yOffsetPercent. PlayRes matches the real output resolution so
        positioning and sizing are correct at 720p as well as 1080p.
        """
        caps: CaptionSettings = project.captions
        font_name = caps.fontFamily
        # ASS font size is scaled to the output width (the previous code
        # doubled it for 1080 wide; keep that proportion at other widths).
        font_size = int(round(caps.fontSize * 2 * out_width / 1080))
        bold = -1 if str(caps.fontWeight).lower() in ("bold", "800", "700") else 0

        text_ass_color = self._color_to_ass(caps.textColor)
        highlight_ass_color = self._color_to_ass(caps.highlightColor)
        back_ass_color = self._color_to_ass(caps.backgroundColor, default_alpha=0x80)

        # ASS header
        content = [
            "[Script Info]",
            "Title: ReelCut AI Subtitles",
            "ScriptType: v4.00+",
            "WrapStyle: 0",
            f"PlayResX: {out_width}",
            f"PlayResY: {out_height}",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            f"Style: ReelDefault,{font_name},{font_size},{text_ass_color},&H000000FF&,&H00000000&,{back_ass_color},{bold},0,0,0,100,100,0,0,1,3,2,2,40,40,{int(out_height * (1 - caps.yOffsetPercent / 100))},1",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ]

        def format_time(seconds: float) -> str:
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            s = int(seconds % 60)
            cs = int(round((seconds - int(seconds)) * 100))
            if cs >= 100:
                s += 1
                cs = 0
            return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

        # Remap original transcript timestamps to the concatenated output timeline.
        # NOTE: there is deliberately no segment-level guard here. A segment
        # whose end falls in a cut gap (or past the 60s cap) must NOT lose
        # all its captions: each word batch is mapped on its own, and a
        # batch that straddles a cut boundary is clamped to the end of the
        # retained interval its words fall in.
        for seg in project.transcript:
            if not seg.isKept:
                continue

            # Break into short batches of words for kinetic captions
            words = seg.words if seg.words else []
            if words:
                batch_size = max(2, min(5, caps.wordsPerBatch))
                for i in range(0, len(words), batch_size):
                    batch = words[i:i + batch_size]
                    # Map each word separately. A word whose start falls in
                    # a cut gap was cut from the video, so it gets no
                    # caption; a word whose end runs past a cut boundary or
                    # the 60s cap is clamped to the end of the retained
                    # interval it starts in.
                    kept = []
                    for w in batch:
                        ws, cap = self._map_with_cap(w.start, time_offset_map)
                        if ws is None:
                            continue
                        we, _ = self._map_with_cap(w.end, time_offset_map)
                        if we is None:
                            we = cap
                        if we > ws:
                            kept.append((w, ws, we))
                    if not kept:
                        continue
                    b_start = kept[0][1]
                    b_end = kept[-1][2]
                    # Highlight important word or first keyword, using the
                    # user's chosen highlightStyle (glow / box / scale /
                    # underline). Only words that survive the cut are shown.
                    styled_words = []
                    for idx, (w, _, _) in enumerate(kept):
                        clean_w = w.word.strip(".,!?:;\"'").lower()
                        # Highlight if keyword or prominent
                        if idx == 0 or len(clean_w) > 5 or w.isFiller:
                            styled_words.append(
                                self._style_highlighted_word(
                                    w.word, caps.highlightStyle, highlight_ass_color
                                )
                            )
                        else:
                            styled_words.append(w.word)
                    text_line = " ".join(styled_words)
                    content.append(
                        f"Dialogue: 0,{format_time(b_start)},{format_time(b_end)},ReelDefault,,0,0,0,,{text_line}"
                    )
            else:
                # Whole segment line (no word timings): anchor on seg.start
                # and clamp the end to the retained interval it falls in.
                out_start, cap = self._map_with_cap(seg.start, time_offset_map)
                if out_start is None:
                    continue
                out_end, _ = self._map_with_cap(seg.end, time_offset_map)
                if out_end is None:
                    out_end = cap
                if out_end > out_start:
                    content.append(
                        f"Dialogue: 0,{format_time(out_start)},{format_time(out_end)},ReelDefault,,0,0,0,,{seg.text}"
                    )

        with open(ass_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content))

    def _map_with_cap(self, src_t: float, offset_map: List[tuple]):
        """
        Like _map_source_to_output, but also returns the output end of the
        retained interval the timestamp maps into, so a caption can be
        clamped to a cut boundary (or the 60s cap) instead of being dropped.
        Returns (out_t, out_interval_end), or (None, None) when src_t falls
        in a cut gap (or past the end of the kept timeline).
        """
        for s_start, s_end, o_start, o_end in offset_map:
            if s_start <= src_t <= s_end:
                return o_start + (src_t - s_start), o_end
            # If timestamp is slightly before the interval boundary due to rounding
            if abs(src_t - s_start) < 0.15:
                return o_start, o_end
        return None, None

    def _map_source_to_output(self, src_t: float, offset_map: List[tuple]) -> Optional[float]:
        """
        Maps a timestamp from the original video to the edited output timeline.
        offset_map contains tuples: (src_start, src_end, out_start, out_end)
        """
        for s_start, s_end, o_start, o_end in offset_map:
            if s_start <= src_t <= s_end:
                return o_start + (src_t - s_start)
            # If timestamp is slightly before the interval boundary due to rounding
            if abs(src_t - s_start) < 0.15:
                return o_start
        return None

    def render(
        self,
        project: ProjectState,
        source_video_path: str,
        output_mp4_path: str,
        progress_callback: Optional[Callable[[int, str], None]] = None,
        render_options: Optional[dict] = None
    ) -> dict:
        """
        Executes the complete video editing and rendering pipeline using FFmpeg.

        render_options (from the Export page): resolution '1080x1920' or
        '720x1280', fps 30 or 60, qualityPreset 'high' (crf 18) /
        'balanced' (crf 22) / 'compact' (crf 26). Unknown values fall back
        to 1080x1920 / 30fps / balanced.
        """
        if progress_callback:
            progress_callback(5, "Validating source footage and edit plan")

        if not os.path.exists(source_video_path):
            raise FileNotFoundError(f"Source video not found: {source_video_path}")

        meta = project.metadata
        if not meta:
            raise ValueError("Missing video metadata")

        # 1. Determine retained intervals
        intervals: List[TimeInterval] = []
        if project.editPlan and project.editPlan.retainedIntervals:
            intervals = project.editPlan.retainedIntervals
        else:
            # Fallback to keeping segments marked isKept
            for seg in project.transcript:
                if seg.isKept:
                    intervals.append(TimeInterval(start=seg.start, end=seg.end))

        # If no intervals specified, retain entire video up to 60s
        if not intervals:
            intervals = [TimeInterval(start=0.0, end=min(60.0, meta.duration))]

        # Ensure max 60s limit
        total_duration = sum(iv.end - iv.start for iv in intervals)
        if total_duration > 60.0:
            # Trim to 60.0s
            accum = 0.0
            capped_intervals = []
            for iv in intervals:
                iv_dur = iv.end - iv.start
                if accum + iv_dur <= 60.0:
                    capped_intervals.append(iv)
                    accum += iv_dur
                else:
                    remain = 60.0 - accum
                    if remain > 0.5:
                        capped_intervals.append(TimeInterval(start=iv.start, end=iv.start + remain))
                    break
            intervals = capped_intervals

        # Build time mapping table: (src_start, src_end, out_start, out_end)
        time_offset_map = []
        cur_out = 0.0
        for iv in intervals:
            dur = iv.end - iv.start
            time_offset_map.append((iv.start, iv.end, cur_out, cur_out + dur))
            cur_out += dur
        final_video_duration = cur_out

        # Export options chosen on the Export page. Unknown values fall back
        # to the previous behaviour (1080x1920, 30fps, crf 22).
        options = render_options or {}
        resolution = options.get("resolution", "1080x1920")
        out_w, out_h = (720, 1280) if resolution == "720x1280" else (1080, 1920)
        fps = options.get("fps", 30)
        fps = 60 if fps == 60 else 30
        quality_preset = options.get("qualityPreset", "balanced")
        crf = {"high": 18, "balanced": 22, "compact": 26}.get(quality_preset, 22)

        if progress_callback:
            progress_callback(20, f"Prepared {len(intervals)} cut segments ({final_video_duration:.1f}s)")
            progress_callback(25, f"Output {out_w}x{out_h} at {fps}fps (crf {crf})")


        with tempfile.TemporaryDirectory() as tmpdir:
            # 2. Extract cut segments or construct FFmpeg select / concat filter
            # Compute 9:16 crop box
            crop_w, crop_h, crop_x, crop_y = self.cropper.calculate_crop_box(
                meta.width, meta.height, project.crop
            )

            if progress_callback:
                progress_callback(35, "Generating subtitles and title overlay")

            # 3. Generate subtitles ASS file
            ass_path = os.path.join(tmpdir, "captions.ass")
            if project.captions.enabled:
                self.generate_ass_subtitles(project, ass_path, time_offset_map, out_w, out_h)

            # 4. Construct FFmpeg filter graph
            # For each interval, trim video and audio
            filter_chains = []
            concat_v_inputs = []
            concat_a_inputs = []

            for i, iv in enumerate(intervals):
                filter_chains.append(
                    f"[0:v]trim=start={iv.start:.3f}:end={iv.end:.3f},setpts=PTS-STARTPTS[v{i}]"
                )
                filter_chains.append(
                    f"[0:a]atrim=start={iv.start:.3f}:end={iv.end:.3f},asetpts=PTS-STARTPTS[a{i}]"
                )
                concat_v_inputs.append(f"[v{i}]")
                concat_a_inputs.append(f"[a{i}]")

            # Concatenate
            num_parts = len(intervals)
            v_inputs_str = "".join(concat_v_inputs)
            a_inputs_str = "".join(concat_a_inputs)
            filter_chains.append(
                f"{v_inputs_str}concat=n={num_parts}:v=1:a=0[v_cat]"
            )
            filter_chains.append(
                f"{a_inputs_str}concat=n={num_parts}:v=0:a=1[a_cat]"
            )

            # Crop to 9:16 and scale to the chosen output resolution
            v_post = f"[v_cat]crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:black"

            # Burn subtitles if enabled
            if project.captions.enabled and os.path.exists(ass_path):
                # Escape path for FFmpeg filter
                escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")
                v_post += f",subtitles='{escaped_ass}'"

            # Title card overlay if enabled
            tc: TitleCardSettings = project.titleCard
            if tc.enabled and tc.title:
                clean_title = tc.title.replace("'", "").replace(":", "-")
                clean_sub = tc.subtitle.replace("'", "").replace(":", "-")
                dur = tc.durationSeconds
                # Title-card geometry is tuned for 1080x1920; scale it to
                # the real output height so it fits at 720p too.
                hf = out_h / 1920.0
                box_y = int(230 * hf)
                box_h = int(220 * hf)
                title_fs = max(12, int(56 * hf))
                sub_fs = max(10, int(34 * hf))
                title_y = int(270 * hf)
                sub_y = int(360 * hf)
                accent = tc.accentColor.lstrip("#") if tc.accentColor.startswith("#") else "14B8A6"
                # Draw title box and text for the first 'dur' seconds
                v_post += (
                    f",drawbox=y={box_y}:color=black@0.65:width=iw:height={box_h}:t=fill:enable='between(t,0,{dur})'"
                    f",drawtext=text='{clean_title}':fontsize={title_fs}:fontcolor=white:x=(w-text_w)/2:y={title_y}:enable='between(t,0,{dur})'"
                    f",drawtext=text='{clean_sub}':fontsize={sub_fs}:fontcolor=0x{accent}:x=(w-text_w)/2:y={sub_y}:enable='between(t,0,{dur})'"
                )

            v_post += "[v_final]"
            filter_chains.append(v_post)

            # Audio processing: optional noise reduction + loudness
            # normalisation (only when enabled in the Audio settings),
            # then the fade in/out.
            fade_in = project.audio.fadeInSeconds
            fade_out = project.audio.fadeOutSeconds
            fade_out_start = max(0.0, final_video_duration - fade_out)
            audio_filters = []
            if project.audio.reduceNoise:
                audio_filters.append("afftdn=nf=-25")
            if project.audio.normalize:
                audio_filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
            audio_filters.append(f"afade=t=in:st=0:d={fade_in}")
            audio_filters.append(f"afade=t=out:st={fade_out_start:.3f}:d={fade_out}")
            a_post = "[a_cat]" + ",".join(audio_filters) + "[a_final]"
            filter_chains.append(a_post)

            full_filter = ";".join(filter_chains)

            if progress_callback:
                progress_callback(55, "Encoding vertical 9:16 MP4 with H.264 & AAC")

            # Execute FFmpeg command
            cmd = [
                FFMPEG_BIN,
                "-y",
                "-i", str(source_video_path),
                "-filter_complex", full_filter,
                "-map", "[v_final]",
                "-map", "[a_final]",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", str(crf),
                "-c:a", "aac",
                "-b:a", "192k",
                "-r", str(fps),
                "-movflags", "+faststart",
                str(output_mp4_path)
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            _, stderr = process.communicate()

            if process.returncode != 0:
                print(f"FFmpeg render error: {stderr}")
                raise RuntimeError(f"FFmpeg failed with exit code {process.returncode}: {stderr[-400:]}")

            if not os.path.exists(output_mp4_path) or os.path.getsize(output_mp4_path) == 0:
                raise RuntimeError("Render completed but output file is missing or empty")

            file_size = os.path.getsize(output_mp4_path)

            if progress_callback:
                progress_callback(100, "Rendering complete")

            return {
                "success": True,
                "outputPath": output_mp4_path,
                "duration": round(final_video_duration, 2),
                "fileSizeBytes": file_size,
                "resolution": f"{out_w}x{out_h}",
                "fps": fps
            }
