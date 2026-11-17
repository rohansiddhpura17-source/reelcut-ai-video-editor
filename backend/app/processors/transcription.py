import os
import re
import subprocess
from pathlib import Path
from typing import List, Tuple
from ..models.schemas import TranscriptSegment, WordTiming
from ..core.config import FFMPEG_BIN

# Single-word fillers flagged on word timings. Multi-word fillers
# ("you know", "sort of", ...) are handled by FillerDetector.
FILLER_WORDS = {"um", "umm", "uh", "uhh", "ah", "ahh", "er", "hmm", "basically", "like"}


class TranscriptionUnavailableError(RuntimeError):
    """Raised when speech recognition cannot run (missing dependency/model)."""


class TranscriptionEngine:
    """
    Real speech recognition with faster-whisper (Whisper 'tiny' model, CPU).

    Transcribes the extracted audio for real words + word timestamps, then
    groups words into segments aligned to the silence boundaries found by
    FFmpeg silencedetect. Never invents transcript text: if the model or its
    dependency is unavailable, transcribe() raises
    TranscriptionUnavailableError and the caller must report that instead
    of showing a transcript.
    """

    def __init__(self, model_size: str = "tiny"):
        self.model_size = model_size
        self._model = None

    def _load_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                raise TranscriptionUnavailableError(
                    "faster-whisper is not installed. Install it with: "
                    "pip install faster-whisper"
                ) from e
            try:
                self._model = WhisperModel(
                    self.model_size, device="cpu", compute_type="int8"
                )
            except Exception as e:
                raise TranscriptionUnavailableError(
                    f"Could not load Whisper model '{self.model_size}' "
                    f"(first run downloads it from Hugging Face): {e}"
                ) from e
        return self._model

    def extract_audio(self, video_path: str) -> str:
        audio_path = Path(video_path).with_suffix(".wav")
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(audio_path)
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return str(audio_path)

    def _speech_chunks(self, video_path: str, duration: float) -> List[Tuple[float, float]]:
        """Speech intervals between silences (silencedetect, d=0.6s)."""
        cmd = [
            FFMPEG_BIN,
            "-i", str(video_path),
            "-af", "silencedetect=noise=-30dB:d=0.6",
            "-f", "null",
            "-"
        ]
        silence_intervals = []
        try:
            res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, check=False)
            starts = [float(m.group(1)) for m in re.finditer(r"silence_start:\s*([0-9.]+)", res.stderr)]
            ends = [float(m.group(1)) for m in re.finditer(r"silence_end:\s*([0-9.]+)", res.stderr)]
            for s, e in zip(starts, ends):
                silence_intervals.append((s, e))
        except Exception as e:
            print(f"Error extracting audio silence intervals: {e}")

        speech_chunks: List[Tuple[float, float]] = []
        last_end = 0.0
        for s_start, s_end in silence_intervals:
            if s_start > last_end + 0.3:
                speech_chunks.append((last_end, s_start))
            last_end = s_end
        if duration > last_end + 0.3:
            speech_chunks.append((last_end, duration))

        # If no silence detected, chunk every 4-6 seconds
        if not speech_chunks:
            step = 5.0
            cur = 0.0
            while cur < duration:
                speech_chunks.append((cur, min(duration, cur + step)))
                cur += step
        return speech_chunks

    def transcribe(self, video_path: str, duration: float) -> List[TranscriptSegment]:
        """
        Transcribes speech from the video file with faster-whisper.
        Returns timestamped segments built from real recognised words.
        Returns [] when no speech is recognised (e.g. tone-only video).
        Raises TranscriptionUnavailableError when recognition cannot run.
        """
        model = self._load_model()
        audio_path = self.extract_audio(video_path)
        try:
            segments, _info = model.transcribe(
                audio_path,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
            )
            whisper_words: List[Tuple[float, float, str, float]] = []
            for seg in segments:
                for w in (seg.words or []):
                    whisper_words.append(
                        (float(w.start), float(w.end), w.word.strip(), float(w.probability))
                    )
        finally:
            try:
                os.unlink(audio_path)
            except OSError:
                pass

        if not whisper_words:
            # No speech recognised. Empty transcript, never invented text.
            return []

        chunks = self._speech_chunks(video_path, duration)
        out: List[TranscriptSegment] = []
        for chunk_start, chunk_end in chunks:
            in_chunk = [
                w for w in whisper_words
                if chunk_start - 0.05 <= w[0] < chunk_end + 0.05
            ]
            if not in_chunk:
                continue
            text = " ".join(w[2] for w in in_chunk)
            text = re.sub(r"\s+([,.!?;:])", r"\1", text)
            words: List[WordTiming] = []
            for w_idx, (w_start, w_end, w_text, w_prob) in enumerate(in_chunk):
                clean_w = w_text.strip(".,!?:;\"'").lower()
                words.append(
                    WordTiming(
                        id=f"seg_{len(out) + 1}_w{w_idx + 1}",
                        word=w_text,
                        start=round(w_start, 2),
                        end=round(w_end, 2),
                        confidence=round(w_prob, 2),
                        isFiller=clean_w in FILLER_WORDS
                    )
                )
            mean_conf = sum(w[3] for w in in_chunk) / len(in_chunk)
            out.append(
                TranscriptSegment(
                    id=f"seg_{len(out) + 1}",
                    start=round(chunk_start, 2),
                    end=round(chunk_end, 2),
                    text=text,
                    words=words,
                    confidence=round(mean_conf, 2),
                    isKept=True,
                    category='speech',
                    speaker='Speaker 1'
                )
            )
        return out
