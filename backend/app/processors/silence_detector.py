import re
import subprocess
from typing import List
from ..models.schemas import SilenceInterval
from ..core.config import FFMPEG_BIN

class SilenceDetector:
    def __init__(self, noise_threshold_db: float = -30.0, min_duration_sec: float = 0.75):
        self.noise_threshold_db = noise_threshold_db
        self.min_duration_sec = min_duration_sec

    def detect_silences(self, video_path: str) -> List[SilenceInterval]:
        """
        Runs FFmpeg with the silencedetect filter to locate intervals of silence.
        """
        silences: List[SilenceInterval] = []
        cmd = [
            FFMPEG_BIN,
            "-i", str(video_path),
            "-af", f"silencedetect=noise={self.noise_threshold_db}dB:d={self.min_duration_sec}",
            "-f", "null",
            "-"
        ]

        try:
            result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, check=False)
            output = result.stderr

            silence_starts = []
            silence_start_pattern = re.compile(r"silence_start:\s*([0-9.]+)")
            silence_end_pattern = re.compile(r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)")

            idx = 1
            for line in output.splitlines():
                start_match = silence_start_pattern.search(line)
                if start_match:
                    silence_starts.append(float(start_match.group(1)))

                end_match = silence_end_pattern.search(line)
                if end_match:
                    end_time = float(end_match.group(1))
                    duration = float(end_match.group(2))
                    start_time = silence_starts.pop(0) if silence_starts else max(0.0, end_time - duration)
                    
                    # One rule, used everywhere (detector, edit plan, UI copy):
                    # silences >= 0.75s are detected and shown; only silences
                    # >= 1.0s are proposed as cuts (suggestedAction='cut').
                    # Shorter silences are kept to preserve natural cadence.
                    if duration >= 0.75:
                        silences.append(
                            SilenceInterval(
                                id=f"silence_{idx}",
                                start=round(start_time, 2),
                                end=round(end_time, 2),
                                duration=round(duration, 2),
                                suggestedAction="cut" if duration >= 1.0 else "keep"
                            )
                        )
                        idx += 1
        except Exception as e:
            print(f"Error running silence detection: {e}")

        return silences
