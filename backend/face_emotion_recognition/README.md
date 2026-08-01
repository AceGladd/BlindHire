# Real-Time Facial Emotion & Gaze Tracking

This repository contains a modular Python application for **real-time facial emotion recognition** and **eye gaze tracking** using a webcam. It is specifically designed for scenarios requiring continuous user analysis, such as online interviews, proctoring systems (anti-cheat), and user behavior studies.

## 🚀 Features

- **Real-Time Emotion Recognition:** Analyzes facial expressions and classifies them into 7 emotions (Neutral, Happiness, Sadness, Surprise, Fear, Disgust, Anger) using a pre-trained ResNet50 + LSTM architecture.
- **Dynamic Model Switching:** Seamlessly switch between different LSTM models trained on various datasets (Aff-Wild2, CREMA-D, IEMOCAP, RAMAS, RAVDESS, SAVEE) at runtime.
- **Robust Gaze Tracking (Anti-Cheat):** Combines MediaPipe iris ratios with head-pose estimation (solvePnP), exponential smoothing and debouncing to reliably tell whether the user is looking at the screen. If the user looks away continuously for **10 seconds**, a flashing on-screen alert fires.
- **Interview / Proctoring Mode:** Detects no-face and multiple-face situations, logs every violation (looked away, no face, multiple people) with timestamps, and writes a JSON session report (duration, violation log, emotion distribution) when the session ends.
- **Optimized Real-Time Performance:** Threaded camera capture (never blocks/falls behind), downscaled MediaPipe inference, frame-skipped emotion inference, and `torch.no_grad()` inference to minimize stutter.
- **Modular Architecture:** Clean and maintainable project structure separating models, utilities, and execution logic.

## 📁 Project Structure

```text
face_emotion_recognition/
├── models/                         # Pre-trained model weights (*.pt)
├── notebooks/                      # Jupyter notebooks for experimentation
├── src/                            # Source code modules
│   ├── models/
│   │   ├── resnet.py               # ResNet50 architecture for feature extraction
│   │   └── lstm.py                 # LSTM architecture for temporal dynamics
│   ├── utils/
│   │   ├── gaze.py                 # MediaPipe iris tracking and gaze logic
│   │   ├── image.py                # Tensor transformations and processing
│   │   └── display.py              # OpenCV drawing utilities (boxes, text, FPS)
│   └── main.py                     # Main webcam execution loop
├── README.md
└── requirements.txt
```

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd face_emotion_recognition
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install the dependencies:**
   Make sure you install the specific version of MediaPipe defined in the requirements to ensure compatibility with the Face Mesh API.
   ```bash
   pip install -r requirements.txt
   ```

## 💻 Usage

To start the real-time webcam analysis, navigate to the `src` directory and run `main.py`:

```bash
cd src
python main.py
```

### Controls during runtime:
- **`m` key:** Switch between different LSTM emotion models dynamically.
- **`c` key:** Calibrate gaze center — look straight at the screen and press `c` to recenter thresholds to your resting eye/head position.
- **`q` key:** Quit the application (writes a session report to `face_emotion_recognition/reports/`).

## 🧠 Gaze Tracking & Calibration
Gaze state is derived from two independent, smoothed signals: iris position within the eye socket and head yaw/pitch (via `cv2.solvePnP`). Both are debounced across several frames before the state changes, so momentary MediaPipe jitter won't cause false "away" flickers. If either signal indicates the user isn't looking at the screen for **10 continuous seconds**, a flashing red banner appears and the event is logged.

If the system frequently misclassifies your natural gaze as "Away", press `c` while looking at the screen to recalibrate, or adjust the thresholds/constants at the top of `src/utils/gaze.py`.

## 🎥 Interview / Proctoring Session Report
Every run tracks:
- **Looked away** events (>= 10s continuous away)
- **No face detected** events (>= 3s)
- **Multiple faces detected** events (a second person entering frame)
- **Emotion distribution** over the session

On quit, a summary is printed to the console and a JSON report is saved under `face_emotion_recognition/reports/`.

## 📚 Acknowledgements & Citations

The emotion recognition models (ResNet50 + LSTM) and weights provided in this repository are based on the **EMO-AffectNet** project by Elena Ryumina. 

If you use the emotion recognition models in your research, please cite their paper:
```bibtex
@article{RYUMINA2022,
  title        = {{In Search of a Robust Facial Expressions Recognition Model: A Large-Scale Visual Cross-Corpus Study}},
  author       = {{Elena Ryumina and Denis Dresvyanskiy and Alexey Karpov}},
  journal      = {{Neurocomputing}},
  year         = {2022},
  doi          = {10.1016/j.neucom.2022.10.013},
  url          = {https://www.sciencedirect.com/science/article/pii/S0925231222012656},
}
```