"""Interview-monitoring session state: violation logging, no-face /
multi-face detection and an end-of-session report.

This module has no dependency on the vision pipeline internals — it only
consumes simple values (gaze alerts, face counts, emotion labels) so it
can be reused or unit tested independently of MediaPipe/torch.
"""

import json
import os
import time
from collections import Counter


class InterviewSession:
    def __init__(self, no_face_threshold_seconds=3.0, report_dir="../reports"):
        self.start_time = time.time()
        self.no_face_threshold_seconds = no_face_threshold_seconds
        self.report_dir = report_dir

        self.violations = []          # list of dicts: {type, duration, at}
        self.emotion_counter = Counter()

        self._gaze_alert_open = False
        self._no_face_since = None
        self._no_face_violation_open = False
        self._multi_face_streak = 0

    # -- per-frame updates --------------------------------------------
    def update_face_count(self, num_faces):
        now = time.time()
        if num_faces == 0:
            if self._no_face_since is None:
                self._no_face_since = now
            elapsed = now - self._no_face_since
            if elapsed >= self.no_face_threshold_seconds and not self._no_face_violation_open:
                self._no_face_violation_open = True
                self.violations.append({
                    "type": "no_face",
                    "at": now - self.start_time,
                    "duration": None,  # filled in when face returns
                })
            return elapsed if elapsed >= self.no_face_threshold_seconds else 0.0
        else:
            if self._no_face_violation_open:
                # close the open no_face violation with its final duration
                self.violations[-1]["duration"] = now - self._no_face_since
                self._no_face_violation_open = False
            self._no_face_since = None

            if num_faces > 1:
                self._multi_face_streak += 1
                if self._multi_face_streak == 3:  # ~3 consecutive frames debounce
                    self.violations.append({
                        "type": "multiple_faces",
                        "at": now - self.start_time,
                        "duration": None,
                        "count": num_faces,
                    })
            else:
                self._multi_face_streak = 0
            return 0.0

    def update_gaze(self, gaze_result):
        """Call once per frame with the latest GazeResult. Logs a single
        violation entry on the rising edge of a sustained look-away."""
        if gaze_result.alert and not self._gaze_alert_open:
            self._gaze_alert_open = True
            self.violations.append({
                "type": "looked_away",
                "at": time.time() - self.start_time,
                "duration": gaze_result.away_seconds,
            })
        elif not gaze_result.alert:
            self._gaze_alert_open = False

    def record_emotion(self, label):
        if label:
            self.emotion_counter[label] += 1

    # -- reporting -------------------------------------------------------
    def summary(self):
        elapsed = time.time() - self.start_time
        dominant_emotion = self.emotion_counter.most_common(1)
        return {
            "duration_seconds": round(elapsed, 1),
            "violation_count": len(self.violations),
            "violations": self.violations,
            "emotion_distribution": dict(self.emotion_counter),
            "dominant_emotion": dominant_emotion[0][0] if dominant_emotion else None,
        }

    def save_report(self):
        try:
            os.makedirs(self.report_dir, exist_ok=True)
            filename = time.strftime("interview_report_%Y%m%d_%H%M%S.json")
            path = os.path.join(self.report_dir, filename)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self.summary(), f, indent=2, ensure_ascii=False)
            return path
        except OSError as e:
            print("Could not save session report:", e)
            return None
