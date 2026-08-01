"""Robust gaze / attention tracking for interview-style monitoring.

Combines two independent signals so a single noisy cue can't cause a
false "looking away" reading:

1. Iris position ratio inside the eye socket (catches eye-only movement).
2. Head pose (yaw/pitch) via solvePnP (catches head turns).

Both signals are exponentially smoothed and the resulting on/off-screen
state is debounced (hysteresis) so single-frame jitter from MediaPipe
does not flip the state. A running timer reports how long the user has
been continuously looking away, which the caller uses to raise a
10-second "away" alert.
"""

import time
from collections import namedtuple

import cv2
import numpy as np

# --- MediaPipe FaceMesh landmark indices used below -----------------------
RIGHT_IRIS = 468
RIGHT_EYE_OUTER = 33
RIGHT_EYE_INNER = 133
RIGHT_EYE_TOP = 159
RIGHT_EYE_BOTTOM = 145

LEFT_IRIS = 473
LEFT_EYE_INNER = 362
LEFT_EYE_OUTER = 263
LEFT_EYE_TOP = 386
LEFT_EYE_BOTTOM = 374

# 6 points used for head-pose estimation (image-position paired, not
# anatomically paired, so left/right stay consistent with the 3D model).
_POSE_LANDMARK_IDS = [1, 152, 33, 263, 61, 291]
_MODEL_POINTS_3D = np.array([
    (0.0, 0.0, 0.0),          # Nose tip            -> landmark 1
    (0.0, -330.0, -65.0),     # Chin                -> landmark 152
    (-225.0, 170.0, -135.0),  # Left side of image  -> landmark 33
    (225.0, 170.0, -135.0),   # Right side of image -> landmark 263
    (-150.0, -150.0, -125.0), # Left side of image  -> landmark 61
    (150.0, -150.0, -125.0),  # Right side of image -> landmark 291
], dtype=np.float64)

# Iris-ratio thresholds (fraction of eye width/height). Widened vs. a
# naive 0.5-centered range because looking at the edges of a wide
# monitor with the head held still is normal eye movement, not
# "looking away" -- the right side is given extra margin since that's
# where users most often glance without turning their head.
_RATIO_X_LOW, _RATIO_X_HIGH = 0.28, 0.75
_RATIO_Y_LOW, _RATIO_Y_HIGH = 0.20, 0.75

# Head-pose thresholds in degrees.
_YAW_THRESHOLD = 22.0
_PITCH_THRESHOLD = 20.0

GazeResult = namedtuple(
    "GazeResult",
    ["state", "on_screen", "away_seconds", "alert", "yaw", "pitch", "ratio_x", "ratio_y", "pose_ok"],
)


def _estimate_head_pose(face_landmarks, w, h):
    """Returns (yaw_deg, pitch_deg, success)."""
    image_points = np.array([
        (face_landmarks.landmark[i].x * w, face_landmarks.landmark[i].y * h)
        for i in _POSE_LANDMARK_IDS
    ], dtype=np.float64)

    focal_length = w
    center = (w / 2.0, h / 2.0)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    success, rotation_vec, _ = cv2.solvePnP(
        _MODEL_POINTS_3D, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not success:
        return 0.0, 0.0, False

    rotation_mat, _ = cv2.Rodrigues(rotation_vec)
    angles, _, _ = cv2.RQDecomp3x3(rotation_mat)[0:3]
    pitch, yaw = angles[0], angles[1]
    # Normalize pitch into a small range around 0 (RQDecomp can return
    # values near +/-180 depending on head orientation).
    if pitch > 90:
        pitch -= 180
    elif pitch < -90:
        pitch += 180
    return float(yaw), float(pitch), True


def _iris_ratios(face_landmarks):
    right_iris = face_landmarks.landmark[RIGHT_IRIS]
    right_eye_outer = face_landmarks.landmark[RIGHT_EYE_OUTER]
    right_eye_inner = face_landmarks.landmark[RIGHT_EYE_INNER]
    right_eye_top = face_landmarks.landmark[RIGHT_EYE_TOP]
    right_eye_bottom = face_landmarks.landmark[RIGHT_EYE_BOTTOM]

    left_iris = face_landmarks.landmark[LEFT_IRIS]
    left_eye_inner = face_landmarks.landmark[LEFT_EYE_INNER]
    left_eye_outer = face_landmarks.landmark[LEFT_EYE_OUTER]
    left_eye_top = face_landmarks.landmark[LEFT_EYE_TOP]
    left_eye_bottom = face_landmarks.landmark[LEFT_EYE_BOTTOM]

    ratio_x_right = (right_iris.x - right_eye_outer.x) / (right_eye_inner.x - right_eye_outer.x + 1e-6)
    ratio_y_right = (right_iris.y - right_eye_top.y) / (right_eye_bottom.y - right_eye_top.y + 1e-6)

    ratio_x_left = (left_iris.x - left_eye_inner.x) / (left_eye_outer.x - left_eye_inner.x + 1e-6)
    ratio_y_left = (left_iris.y - left_eye_top.y) / (left_eye_bottom.y - left_eye_top.y + 1e-6)

    ratio_x = (ratio_x_right + ratio_x_left) / 2.0
    ratio_y = (ratio_y_right + ratio_y_left) / 2.0
    return ratio_x, ratio_y


class GazeTracker:
    """Stateful, smoothed, debounced gaze/attention tracker.

    One instance should persist across the whole session (not be
    recreated per-frame) since it accumulates timing state.
    """

    def __init__(self, away_threshold_seconds=10.0, smoothing=0.35,
                 debounce_frames=5, yaw_threshold=_YAW_THRESHOLD,
                 pitch_threshold=_PITCH_THRESHOLD):
        self.away_threshold_seconds = away_threshold_seconds
        self.smoothing = smoothing
        self.debounce_frames = debounce_frames
        self.yaw_threshold = yaw_threshold
        self.pitch_threshold = pitch_threshold

        self._initialized = False
        self._s_ratio_x = 0.5
        self._s_ratio_y = 0.5
        self._s_yaw = 0.0
        self._s_pitch = 0.0

        self._raw_state = "Center"
        self._state_streak = 0
        self._stable_state = "Center"

        self._away_since = None
        self._alert_active = False

        self.calib_offset_x = 0.0
        self.calib_offset_y = 0.0
        self.calib_yaw = 0.0
        self.calib_pitch = 0.0

    def calibrate(self):
        """Call while the user is looking straight at the screen to
        recenter thresholds around their natural resting position."""
        self.calib_offset_x = self._s_ratio_x - 0.5
        self.calib_offset_y = self._s_ratio_y - 0.5
        self.calib_yaw = self._s_yaw
        self.calib_pitch = self._s_pitch

    def reset(self):
        self._away_since = None
        self._alert_active = False
        self._stable_state = "Center"
        self._raw_state = "Center"
        self._state_streak = 0

    def update(self, face_landmarks, w, h):
        ratio_x, ratio_y = _iris_ratios(face_landmarks)
        yaw, pitch, pose_ok = _estimate_head_pose(face_landmarks, w, h)

        a = self.smoothing
        if not self._initialized:
            self._s_ratio_x, self._s_ratio_y = ratio_x, ratio_y
            self._s_yaw, self._s_pitch = yaw, pitch
            self._initialized = True
        else:
            self._s_ratio_x = a * ratio_x + (1 - a) * self._s_ratio_x
            self._s_ratio_y = a * ratio_y + (1 - a) * self._s_ratio_y
            if pose_ok:
                self._s_yaw = a * yaw + (1 - a) * self._s_yaw
                self._s_pitch = a * pitch + (1 - a) * self._s_pitch

        adj_x = self._s_ratio_x - self.calib_offset_x
        adj_y = self._s_ratio_y - self.calib_offset_y
        rel_yaw = self._s_yaw - self.calib_yaw
        rel_pitch = self._s_pitch - self.calib_pitch

        # Treat eye position and head pose as two independent signals and
        # OR them: yaw and pitch come from the same head-pose estimate and
        # rarely move together (e.g. turning the head sideways to look at
        # a phone changes yaw but not pitch), so requiring both to cross
        # their thresholds at once made real "looking away" go undetected.
        # Per-frame noise is instead handled by smoothing + debounce below.
        eye_away = (adj_x < _RATIO_X_LOW or adj_x > _RATIO_X_HIGH or
                    adj_y < _RATIO_Y_LOW or adj_y > _RATIO_Y_HIGH)
        head_away = pose_ok and (abs(rel_yaw) > self.yaw_threshold or
                                  abs(rel_pitch) > self.pitch_threshold)

        looking_away = eye_away or head_away
        raw_state = "Away" if looking_away else "Center"

        if raw_state == self._raw_state:
            self._state_streak += 1
        else:
            self._raw_state = raw_state
            self._state_streak = 1

        if self._state_streak >= self.debounce_frames:
            self._stable_state = raw_state

        now = time.time()
        away_seconds = 0.0
        alert = False
        if self._stable_state == "Away":
            if self._away_since is None:
                self._away_since = now
            away_seconds = now - self._away_since
            alert = away_seconds >= self.away_threshold_seconds
        else:
            self._away_since = None
            self._alert_active = False

        self._alert_active = alert

        return GazeResult(
            state=self._stable_state,
            on_screen=self._stable_state == "Center",
            away_seconds=away_seconds,
            alert=alert,
            yaw=rel_yaw,
            pitch=rel_pitch,
            ratio_x=adj_x,
            ratio_y=adj_y,
            pose_ok=pose_ok,
        )


def draw_gaze_landmarks(frame, face_landmarks, w, h):
    """Lightweight visual feedback: pupil + eye-corner dots."""
    for idx in (RIGHT_IRIS, LEFT_IRIS):
        lm = face_landmarks.landmark[idx]
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 3, (0, 255, 255), -1)
    for idx in (RIGHT_EYE_OUTER, RIGHT_EYE_INNER, LEFT_EYE_INNER, LEFT_EYE_OUTER):
        lm = face_landmarks.landmark[idx]
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 2, (255, 0, 0), -1)
