import statistics
from typing import Dict, Any, Tuple
from ..models.schemas import CropSettings

# Haar cascade parameters tuned on talking-head footage: scaleFactor 1.05 /
# minNeighbors 4 catches faces reliably while keeping false positives low.
# Confidence = fraction of sampled frames in which a face was found.
_HAAR_SCALE_FACTOR = 1.05
_HAAR_MIN_NEIGHBORS = 4
_HAAR_MIN_SIZE = (40, 40)
_NUM_SAMPLE_FRAMES = 12


class CroppingProcessor:
    _cascade = None

    def __init__(self):
        pass

    def calculate_crop_box(
        self,
        src_width: int,
        src_height: int,
        crop_settings: CropSettings
    ) -> Tuple[int, int, int, int]:
        """
        Calculates (crop_w, crop_h, crop_x, crop_y) for 9:16 output.
        """
        target_aspect = 9.0 / 16.0
        src_aspect = src_width / max(1, src_height)

        # 9:16 crop inside source video
        if src_aspect > target_aspect:
            # Source is wider (e.g. 16:9 horizontal 1920x1080)
            crop_h = int(src_height / crop_settings.zoom)
            crop_w = int(crop_h * target_aspect)
        else:
            # Source is taller or square
            crop_w = int(src_width / crop_settings.zoom)
            crop_h = int(crop_w / target_aspect)

        # Clamp dimensions to source bounds
        crop_w = min(crop_w, src_width)
        crop_h = min(crop_h, src_height)
        # Ensure even numbers for video encoders
        crop_w = crop_w - (crop_w % 2)
        crop_h = crop_h - (crop_h % 2)

        # Compute X and Y offsets
        center_x = (crop_settings.xPercent / 100.0) * src_width
        center_y = (crop_settings.yPercent / 100.0) * src_height

        crop_x = int(center_x - crop_w / 2)
        crop_y = int(center_y - crop_h / 2)

        # Clamp within source boundaries
        crop_x = max(0, min(src_width - crop_w, crop_x))
        crop_y = max(0, min(src_height - crop_h, crop_y))
        crop_x = crop_x - (crop_x % 2)
        crop_y = crop_y - (crop_y % 2)

        return (crop_w, crop_h, crop_x, crop_y)

    @classmethod
    def _get_cascade(cls):
        if cls._cascade is None:
            import cv2
            cls._cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            if cls._cascade.empty():
                raise RuntimeError("Could not load Haar cascade XML")
        return cls._cascade

    def detect_face_in_video(self, video_path: str, src_width: int, src_height: int) -> Dict[str, Any]:
        """
        Real face detection with OpenCV Haar cascades. Samples frames across
        the video, takes the largest face per frame, and returns the median
        face centre. faceConfidence = fraction of sampled frames where a
        face was found. When no face is found, faceDetected=False and the
        crop stays centred (50/50) -- never a fake lock.

        Known limit: on extreme close-ups where the face fills the frame
        (chin/hair cropped by the frame edge) Haar locks onto a stable
        sub-region of the face, so the centre can sit off true centre.
        Head-and-shoulders footage -- the normal talking-head case -- is
        detected accurately. Framing can always be corrected with the
        manual pan/zoom sliders.
        """
        no_face = {
            "faceDetected": False,
            "xPercent": 50,
            "yPercent": 50,
            "faceConfidence": 0.0,
            "mode": "auto_face"
        }
        try:
            import cv2
        except ImportError:
            print("Face detection unavailable: opencv-python-headless is not installed")
            return dict(no_face)
        try:
            cascade = self._get_cascade()
        except Exception as e:
            print(f"Face detection unavailable: {e}")
            return dict(no_face)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Face detection: could not open video {video_path}")
            return dict(no_face)
        try:
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            if total <= 0:
                return dict(no_face)
            idxs = sorted({
                int(i * (total - 1) / max(1, _NUM_SAMPLE_FRAMES - 1))
                for i in range(_NUM_SAMPLE_FRAMES)
            })
            centers_x, centers_y, found = [], [], 0
            for fi in idxs:
                cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
                ok, frame = cap.read()
                if not ok or frame is None:
                    continue
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(
                    gray,
                    scaleFactor=_HAAR_SCALE_FACTOR,
                    minNeighbors=_HAAR_MIN_NEIGHBORS,
                    minSize=_HAAR_MIN_SIZE,
                )
                if len(faces):
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    centers_x.append((x + w / 2) / max(1, src_width) * 100)
                    centers_y.append((y + h / 2) / max(1, src_height) * 100)
                    found += 1
            if not found:
                return dict(no_face)
            return {
                "faceDetected": True,
                "xPercent": int(round(statistics.median(centers_x))),
                "yPercent": int(round(statistics.median(centers_y))),
                "faceConfidence": round(found / len(idxs), 2),
                "mode": "auto_face"
            }
        finally:
            cap.release()
