import re
from typing import List
from ..models.schemas import FillerWordMatch, TranscriptSegment

COMMON_FILLERS = {
    "um", "umm", "uh", "uhh", "ah", "ahh", "er", "like", "you know",
    "basically", "sort of", "kind of", "i mean", "so yeah", "actually"
}

class FillerDetector:
    def __init__(self, custom_fillers: List[str] = None):
        self.fillers = set(custom_fillers) if custom_fillers else COMMON_FILLERS

    def detect_in_transcript(self, segments: List[TranscriptSegment]) -> List[FillerWordMatch]:
        matches: List[FillerWordMatch] = []
        match_idx = 1
        # Multi-word fillers ("you know", "sort of", ...) can never match
        # a single word, so scan consecutive word timings for them too.
        multi_word_fillers = [f for f in self.fillers if " " in f]

        for seg in segments:
            # Check individual word timings if available
            if seg.words:
                for w in seg.words:
                    clean_word = re.sub(r"[^\w\s]", "", w.word.strip().lower())
                    if clean_word in self.fillers:
                        matches.append(
                            FillerWordMatch(
                                id=f"filler_{match_idx}",
                                word=w.word,
                                start=w.start,
                                end=w.end,
                                segmentId=seg.id,
                                confidence=w.confidence
                            )
                        )
                        match_idx += 1
                # Multi-word filler phrases across consecutive words
                clean_words = [
                    re.sub(r"[^\w\s]", "", w.word.strip().lower()) for w in seg.words
                ]
                for phrase in multi_word_fillers:
                    parts = phrase.split()
                    n = len(parts)
                    for i in range(len(seg.words) - n + 1):
                        if clean_words[i:i + n] == parts:
                            span = seg.words[i:i + n]
                            matches.append(
                                FillerWordMatch(
                                    id=f"filler_{match_idx}",
                                    word=" ".join(w.word for w in span),
                                    start=span[0].start,
                                    end=span[-1].end,
                                    segmentId=seg.id,
                                    confidence=min(w.confidence for w in span)
                                )
                            )
                            match_idx += 1
            else:
                # Fallback to phrase search in segment text
                lower_text = seg.text.lower()
                for filler in self.fillers:
                    pattern = r"\b" + re.escape(filler) + r"\b"
                    for m in re.finditer(pattern, lower_text):
                        # Approximate time within segment
                        char_start = m.start()
                        char_end = m.end()
                        text_len = max(len(seg.text), 1)
                        seg_dur = max(0.1, seg.end - seg.start)
                        w_start = seg.start + (char_start / text_len) * seg_dur
                        w_end = seg.start + (char_end / text_len) * seg_dur

                        matches.append(
                            FillerWordMatch(
                                id=f"filler_{match_idx}",
                                word=m.group(),
                                start=round(w_start, 2),
                                end=round(w_end, 2),
                                segmentId=seg.id,
                                confidence=0.88
                            )
                        )
                        match_idx += 1

        return matches
