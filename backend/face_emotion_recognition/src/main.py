import json
import os
import threading
import time
import warnings

import cv2
import numpy as np
import torch
from PIL import Image
import mediapipe as mp

warnings.simplefilter("ignore", UserWarning)

from models.resnet import ResNet50
from models.lstm import LSTMPyTorch
from utils.gaze import GazeTracker, draw_gaze_landmarks
from utils.image import pth_processing
from utils.display import display_EMO_PRED, display_FPS, draw_alert_banner, draw_status_panel
from utils.session import InterviewSession

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
GAZE_AWAY_ALERT_SECONDS = 10.0     # how long the user may look away before an alert fires
NO_FACE_ALERT_SECONDS = 3.0        # how long the face may be missing before an alert fires
EMOTION_INFER_EVERY_N_FRAMES = 2   # run the (expensive) emotion model every Nth frame
MEDIAPIPE_PROCESS_WIDTH = 480      # downscale target for face-mesh inference (perf)
LSTM_WINDOW = 10


class ThreadedCamera:
    """Grabs frames on a background thread so a slow processing loop
    never blocks the capture and never falls behind piling up latency —
    the main loop always reads the newest available frame."""

    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src)
        try:
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except cv2.error:
            pass
        self.w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        self.h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480

        self._lock = threading.Lock()
        self._frame = None
        self._stopped = False
        self._thread = threading.Thread(target=self._update, daemon=True)
        self._thread.start()

        t0 = time.time()
        while self._frame is None and time.time() - t0 < 5.0:
            time.sleep(0.01)

    def _update(self):
        while not self._stopped:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.005)
                continue
            with self._lock:
                self._frame = frame

    def read(self):
        with self._lock:
            if self._frame is None:
                return False, None
            return True, self._frame

    def isOpened(self):
        return self.cap.isOpened()

    def release(self):
        self._stopped = True
        self._thread.join(timeout=1.0)
        self.cap.release()


def compute_face_bbox(face_landmarks, w, h, pad_ratio=0.1):
    coords = np.array([(lm.x, lm.y) for lm in face_landmarks.landmark], dtype=np.float32)
    x_min, y_min = coords.min(axis=0)
    x_max, y_max = coords.max(axis=0)
    x_min, x_max = x_min * w, x_max * w
    y_min, y_max = y_min * h, y_max * h
    box_w, box_h = x_max - x_min, y_max - y_min
    pad_x, pad_y = box_w * pad_ratio, box_h * pad_ratio
    startX = max(0, int(x_min - pad_x))
    startY = max(0, int(y_min - pad_y))
    endX = min(w - 1, int(x_max + pad_x))
    endY = min(h - 1, int(y_max + pad_y))
    return startX, startY, endX, endY


def load_lstm_model(name):
    model = LSTMPyTorch()
    model_path = os.path.join(MODELS_DIR, f'FER_dinamic_LSTM_{name}.pt')
    model.load_state_dict(torch.load(model_path,
                                      map_location=torch.device('cpu'), weights_only=False))
    model.eval()
    return model


def main():
    # Small, fixed thread pool avoids CPU oversubscription overhead on
    # the tiny per-frame tensors this pipeline uses.
    torch.set_num_threads(max(1, min(4, os.cpu_count() or 4)))

    lstm_models = ['Aff-Wild2', 'CREMA-D', 'IEMOCAP', 'RAMAS', 'RAVDESS', 'SAVEE']
    current_model_idx = 0
    name_LSTM_model = lstm_models[current_model_idx]

    pth_backbone_model = ResNet50(7, channels=3)
    resnet_path = os.path.join(MODELS_DIR, 'FER_static_ResNet50_AffectNet.pt')
    pth_backbone_model.load_state_dict(torch.load(resnet_path,
                                                    map_location=torch.device('cpu'), weights_only=False))
    pth_backbone_model.eval()

    pth_LSTM_model = load_lstm_model(name_LSTM_model)

    DICT_EMO = {0: 'Neutral', 1: 'Happiness', 2: 'Sadness', 3: 'Surprise', 4: 'Fear', 5: 'Disgust', 6: 'Anger'}

    cam = ThreadedCamera(0)
    if not cam.isOpened():
        print("Kamera açılamadı.")
        return
    w, h = cam.w, cam.h

    process_scale = (MEDIAPIPE_PROCESS_WIDTH / w) if w > MEDIAPIPE_PROCESS_WIDTH else 1.0
    proc_w, proc_h = max(1, int(w * process_scale)), max(1, int(h * process_scale))

    lstm_features = []
    last_label = None
    last_emotion = None
    last_emotion_conf = None
    frame_idx = 0

    gaze_tracker = GazeTracker(away_threshold_seconds=GAZE_AWAY_ALERT_SECONDS)
    session = InterviewSession(no_face_threshold_seconds=NO_FACE_ALERT_SECONDS)

    mp_face_mesh = mp.solutions.face_mesh
    with mp_face_mesh.FaceMesh(
            max_num_faces=2,  # detect a 2nd person as a proctoring violation
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as face_mesh:

        print('Mülakat oturumu başladı.  "q": çıkış  |  "m": duygu modeli değiştir  |  "c": bakışı kalibre et')

        try:
            while cam.isOpened():
                t1 = time.time()
                success, frame = cam.read()
                if not success or frame is None:
                    time.sleep(0.005)
                    continue

                frame_idx += 1
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                proc_rgb = (cv2.resize(frame_rgb, (proc_w, proc_h), interpolation=cv2.INTER_AREA)
                            if process_scale != 1.0 else frame_rgb)

                results = face_mesh.process(proc_rgb)
                num_faces = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0
                no_face_elapsed = session.update_face_count(num_faces)

                gaze_result = None
                if num_faces >= 1:
                    face_landmarks = results.multi_face_landmarks[0]
                    draw_gaze_landmarks(frame, face_landmarks, w, h)
                    gaze_result = gaze_tracker.update(face_landmarks, w, h)
                    session.update_gaze(gaze_result)

                    startX, startY, endX, endY = compute_face_bbox(face_landmarks, w, h)

                    run_emotion = (frame_idx % EMOTION_INFER_EVERY_N_FRAMES == 0) or not lstm_features
                    if run_emotion:
                        cur_face = frame_rgb[startY:endY, startX:endX]
                        if cur_face.size > 0:
                            try:
                                with torch.no_grad():
                                    cur_face_processed = pth_processing(Image.fromarray(cur_face))
                                    features = torch.nn.functional.relu(
                                        pth_backbone_model.extract_features(cur_face_processed)
                                    ).numpy()
                                    if len(lstm_features) == 0:
                                        lstm_features = [features] * LSTM_WINDOW
                                    else:
                                        lstm_features = lstm_features[1:] + [features]
                                    lstm_f = torch.unsqueeze(torch.from_numpy(np.vstack(lstm_features)), 0)
                                    output = pth_LSTM_model(lstm_f).numpy()
                                cl = int(np.argmax(output))
                                last_emotion = DICT_EMO[cl]
                                last_emotion_conf = float(output[0][cl])
                                last_label = f'{last_emotion} {last_emotion_conf:.1%}'
                                session.record_emotion(last_emotion)
                            except Exception as e:
                                print("Emotion Error:", e)

                    if last_label:
                        frame = display_EMO_PRED(frame, (startX, startY, endX, endY), last_label, line_width=3)

                # ---- Status overlay -----------------------------------------
                status_lines = [f'Model: {name_LSTM_model}  ("m" degistir)']
                if num_faces == 0:
                    status_lines.append(("Yuz bulunamadi", (0, 0, 255)))
                elif num_faces > 1:
                    status_lines.append((f"Uyari: {num_faces} yuz tespit edildi", (0, 0, 255)))

                if gaze_result is not None:
                    gaze_color = (0, 255, 0) if gaze_result.on_screen else (0, 165, 255)
                    gaze_text = f"Bakis: {gaze_result.state}"
                    if not gaze_result.on_screen and gaze_result.away_seconds > 0.3:
                        gaze_text += f" ({gaze_result.away_seconds:.1f}s)"
                    status_lines.append((gaze_text, gaze_color))

                status_lines.append(f"Ihlaller: {len(session.violations)}")
                frame = draw_status_panel(frame, status_lines)
                frame = display_FPS(frame, 'FPS: {0:.1f}'.format(1 / max(1e-6, time.time() - t1)), box_scale=.5)

                if gaze_result is not None and gaze_result.alert:
                    frame = draw_alert_banner(frame, "LUTFEN EKRANA BAKIN!")
                elif num_faces == 0 and no_face_elapsed:
                    frame = draw_alert_banner(frame, "YUZ TESPIT EDILEMIYOR!")
                elif num_faces > 1:
                    frame = draw_alert_banner(frame, "BIRDEN FAZLA KISI TESPIT EDILDI!")

                # ---- Text/JSON output (for backend consumption) --------------
                frame_result = {
                    "timestamp": time.time(),
                    "frame": frame_idx,
                    "num_faces": num_faces,
                    "emotion": last_emotion,
                    "emotion_confidence": last_emotion_conf,
                    "emotion_model": name_LSTM_model,
                    "gaze": None if gaze_result is None else {
                        "state": gaze_result.state,
                        "on_screen": gaze_result.on_screen,
                        "away_seconds": round(gaze_result.away_seconds, 2),
                        "alert": gaze_result.alert,
                    },
                    "violation_count": len(session.violations),
                    "alert": (
                        "looking_away" if gaze_result is not None and gaze_result.alert else
                        "no_face" if num_faces == 0 and no_face_elapsed else
                        "multiple_faces" if num_faces > 1 else
                        None
                    ),
                }
                print(json.dumps(frame_result, ensure_ascii=False), flush=True)

                cv2.imshow('Mulakat Analiz Sistemi - Q: Cikis', frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('m'):
                    current_model_idx = (current_model_idx + 1) % len(lstm_models)
                    name_LSTM_model = lstm_models[current_model_idx]
                    pth_LSTM_model = load_lstm_model(name_LSTM_model)
                    lstm_features = []
                    print(f"Switched to model: {name_LSTM_model}")
                elif key == ord('c'):
                    if gaze_result is not None:
                        gaze_tracker.calibrate()
                        print("Bakis merkeze gore kalibre edildi.")
        finally:
            cam.release()
            cv2.destroyAllWindows()
            report_path = session.save_report()
            summary = session.summary()
            print("\n--- Oturum Ozeti ---")
            print(f"Sure: {summary['duration_seconds']}s")
            print(f"Ihlal sayisi: {summary['violation_count']}")
            print(f"Baskin duygu: {summary['dominant_emotion']}")
            if report_path:
                print(f"Rapor kaydedildi: {report_path}")


if __name__ == "__main__":
    main()
