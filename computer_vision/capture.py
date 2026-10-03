"""
LearnPulse AI - Camera & Frame Stream Handler
Handles real-time webcam frame acquisition using OpenCV or generates clean demo frames
when webcam hardware is unavailable.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Suppress noisy OpenCV C++ backend warning logs
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
os.environ["OPENCV_VIDEOIO_PRIORITY_MSMF"] = "0"

import cv2
import numpy as np
import random
from typing import Optional, Tuple, Dict, Any
from computer_vision.mediapipe_detector import MediaPipeDetector
from config import CAMERA_INDEX

class WebcamCapture:
    """Manages OpenCV VideoCapture and processes frames in memory without saving to disk."""

    def __init__(self, camera_index: int = CAMERA_INDEX):
        self.camera_index = camera_index
        self.cap = None
        self.detector = MediaPipeDetector()
        self.is_running = False

    def start(self) -> bool:
        """Initializes OpenCV video capture device quietly."""
        try:
            # Try default OpenCV backend without DSHOW to avoid Windows driver warnings
            self.cap = cv2.VideoCapture(self.camera_index)
            if self.cap is not None and self.cap.isOpened():
                self.is_running = True
            else:
                self.is_running = False
        except Exception:
            self.is_running = False
        return self.is_running

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Reads a single frame from the webcam stream."""
        if not self.is_running or self.cap is None:
            return False, None
        try:
            ret, frame = self.cap.read()
            return ret, frame
        except Exception:
            return False, None

    def process_live_frame(self, allow_simulation: bool = False) -> Dict[str, Any]:
        """
        Reads one frame and returns extracted numerical engagement metrics.
        If no frame can be read, raises RuntimeError unless allow_simulation is set, in which
        case demo metrics flagged with "simulated": True are returned instead.
        """
        ret, frame = self.read_frame()
        if not ret or frame is None:
            if not allow_simulation:
                raise RuntimeError(f"No frame available from camera index {self.camera_index}")
            return self.generate_simulated_metrics()
        return {**self.detector.process_frame(frame), "simulated": False}

    def stop(self):
        """Releases the camera device."""
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_running = False

    @staticmethod
    def generate_simulated_metrics(mode: str = "Focused") -> Dict[str, Any]:
        """
        Generates privacy-safe simulated numerical metrics for demonstration purposes.
        The result is always flagged with "simulated": True so it is never mistaken for a real reading.
        """
        return {**WebcamCapture._simulated_values(mode), "simulated": True}

    @staticmethod
    def _simulated_values(mode: str) -> Dict[str, Any]:
        if mode == "Focused":
            return {
                "face_detected": True,
                "pitch": random.uniform(-5.0, 5.0),
                "yaw": random.uniform(-5.0, 5.0),
                "roll": random.uniform(-2.0, 2.0),
                "ear": random.uniform(0.28, 0.35),
                "gaze_offset": random.uniform(0.0, 0.1),
                "confidence": 0.98
            }
        elif mode == "Distracted":
            return {
                "face_detected": True,
                "pitch": random.uniform(15.0, 30.0),
                "yaw": random.choice([-25.0, 25.0]),
                "roll": random.uniform(-10.0, 10.0),
                "ear": random.uniform(0.22, 0.28),
                "gaze_offset": random.uniform(0.4, 0.8),
                "confidence": 0.90
            }
        elif mode == "Low Engagement":
            return {
                "face_detected": True,
                "pitch": random.uniform(20.0, 40.0),
                "yaw": random.uniform(-10.0, 10.0),
                "roll": random.uniform(-5.0, 5.0),
                "ear": random.uniform(0.12, 0.18),
                "gaze_offset": random.uniform(0.2, 0.4),
                "confidence": 0.85
            }
        else:  # Away
            return {
                "face_detected": False,
                "pitch": 45.0,
                "yaw": 45.0,
                "roll": 0.0,
                "ear": 0.0,
                "gaze_offset": 1.0,
                "confidence": 0.50
            }
