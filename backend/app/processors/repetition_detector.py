import difflib
from typing import List
from ..models.schemas import RepetitionMatch, TranscriptSegment

class RepetitionDetector:
    def __init__(self, similarity_threshold: float = 0.75):
        self.similarity_threshold = similarity_threshold

    def detect_repetitions(self, segments: List[TranscriptSegment]) -> List[RepetitionMatch]:
        """
        Flags a segment that restates an EARLIER segment (not just its
        immediate neighbour -- a repeated sentence can resurface several
        sentences later). The later, repeated segment is the one reported,
        because that is the part the edit plan should cut.
        """
        repetitions: List[RepetitionMatch] = []
        rep_idx = 1
        already_flagged = set()

        for j in range(len(segments)):
            if segments[j].id in already_flagged:
                continue
            t2 = segments[j].text.strip().lower()
            if len(t2) < 12:
                continue
            for i in range(j):
                t1 = segments[i].text.strip().lower()
                if len(t1) < 12:
                    continue
                ratio = difflib.SequenceMatcher(None, t1, t2).ratio()
                if ratio >= self.similarity_threshold:
                    repetitions.append(
                        RepetitionMatch(
                            id=f"rep_{rep_idx}",
                            originalSegmentId=segments[i].id,
                            repeatedSegmentId=segments[j].id,
                            text=segments[i].text,
                            start=segments[j].start,
                            end=segments[j].end,
                            similarity=round(ratio, 2)
                        )
                    )
                    already_flagged.add(segments[j].id)
                    rep_idx += 1
                    break

        return repetitions
