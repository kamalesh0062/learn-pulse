"""
LearnPulse AI - Feature Extractor
"""

import numpy as np
from typing import Dict, Any, List

class FeatureExtractor:
    @staticmethod
    def extract_feature_vector(metrics: Dict[str, Any]) -> np.ndarray:
        face_detected = 1.0 if metrics.get("face_detected", True) else 0.0
        pitch = float(metrics.get("pitch", 0.0))
        yaw = float(metrics.get("yaw", 0.0))
        roll = float(metrics.get("roll", 0.0))
        ear = float(metrics.get("ear", 0.30))
        gaze_offset = float(metrics.get("gaze_offset", 0.0))

        pitch = max(-90.0, min(90.0, pitch))
        yaw = max(-90.0, min(90.0, yaw))
        roll = max(-90.0, min(90.0, roll))
        ear = max(0.0, min(1.0, ear))
        gaze_offset = max(0.0, min(2.0, gaze_offset))

        return np.array([[face_detected, pitch, yaw, roll, ear, gaze_offset]], dtype=np.float32)

    @staticmethod
    def get_feature_names() -> List[str]:
        return ["face_detected", "pitch", "yaw", "roll", "ear", "gaze_offset"]
