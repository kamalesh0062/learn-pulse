"""
LearnPulse AI - Global Configuration Settings
Defines database paths, ML model settings, CV feature thresholds, 
Difficulty Engine weights, and SaaS Design System tokens.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
DATABASE_DIR = BASE_DIR / "database"
ML_DIR = BASE_DIR / "ml"
DOCS_DIR = BASE_DIR / "docs"

# Ensure directories exist
DATABASE_DIR.mkdir(exist_ok=True)
ML_DIR.mkdir(exist_ok=True)

# Database
DB_PATH = DATABASE_DIR / "learnpulse.db"
SQLITE_URL = f"sqlite:///{DB_PATH}"

# Machine Learning & Computer Vision
MODEL_PATH = ML_DIR / "random_forest.pkl"
CAMERA_INDEX = 0
DEFAULT_FRAME_RATE = 15

# Privacy Settings
RECORD_WEBCAM_VIDEO = False  # Strictly local, in-memory processing only
DETECT_EMOTIONS = False       # Privacy guarantee: No emotion recognition

# Computer Vision Thresholds
EAR_DROWSY_THRESHOLD = 0.20   # Eye Aspect Ratio threshold for drowsiness
POSE_DISTRACTED_YAW = 25.0    # Head turn angle (degrees) for off-screen gaze
POSE_DISTRACTED_PITCH = 20.0  # Head pitch angle for looking down/up away from screen

# Difficulty Engine Weights
WEIGHT_VISUAL_ENGAGEMENT = 0.35
WEIGHT_QUIZ_SCORE = 0.35
WEIGHT_REPLAY_COUNT = 0.15
WEIGHT_PAUSE_COUNT = 0.10
WEIGHT_WATCH_RATIO = 0.05

# Categorical Thresholds for Learning Difficulty
DIFFICULTY_THRESHOLDS = {
    "Easy": (0, 30),
    "Moderate": (31, 55),
    "Difficult": (56, 75),
    "Very Difficult": (76, 100)
}

# Generative AI Defaults
DEFAULT_LLM_PROVIDER = "gemini"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
