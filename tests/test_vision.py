"""
LearnPulse AI - Standalone Computer Vision Test Suite
Runs isolated unit & integration tests on MediaPipeDetector, FeatureExtractor,
predict_engagement_state logic, and fallback rule thresholds.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from computer_vision.mediapipe_detector import MediaPipeDetector
from computer_vision.feature_extractor import FeatureExtractor
from ml.predict import EngagementPredictor, CLASS_LABELS

def test_mediapipe_detector_fallback():
    print("\n[TEST 1] Testing MediaPipeDetector Fallback Output...")
    detector = MediaPipeDetector()
    metrics = detector._fallback_metrics(face_detected=True)
    assert metrics["face_detected"] is True
    assert metrics["pitch"] == 0.0
    assert metrics["yaw"] == 0.0
    assert metrics["ear"] == 0.30
    print("  -> Passed! Fallback metrics structure verified.")

def test_feature_extractor():
    print("\n[TEST 2] Testing FeatureExtractor Vector Mapping...")
    metrics = {
        "face_detected": True,
        "pitch": 5.5,
        "yaw": -12.3,
        "roll": 1.2,
        "ear": 0.29,
        "gaze_offset": 0.08
    }
    vec = FeatureExtractor.extract_feature_vector(metrics)
    assert vec.shape == (1, 6)
    assert vec[0][0] == 1.0
    assert vec[0][1] == 5.5
    assert np.isclose(vec[0][2], -12.3)
    assert np.isclose(vec[0][4], 0.29)
    print("  -> Passed! Feature vector shape (1, 6) and metric alignment verified.")

def test_fine_tuned_engagement_predictor_rules():
    print("\n[TEST 3] Testing Fine-Tuned Rule Engine Thresholds...")
    predictor = EngagementPredictor()

    # Case A: Normal Focused (Head yaw -12 deg, pitch 5 deg, open EAR 0.29) -> Focused
    vec_focused = np.array([[1.0, 5.0, -12.0, 1.0, 0.29, 0.08]], dtype=np.float32)
    state, conf = predictor.predict(vec_focused)
    assert state == "Focused", f"Expected Focused, got {state}"
    print(f"  -> Case A (Focused): {state} ({conf*100:.1f}% confidence) PASS")

    # Case B: Natural Head Panning (Yaw = 22 deg, Pitch = 10 deg) -> Still Focused (expanded yaw threshold)
    vec_panning = np.array([[1.0, 10.0, 22.0, 2.0, 0.28, 0.15]], dtype=np.float32)
    state, conf = predictor.predict(vec_panning)
    assert state == "Focused", f"Expected Focused for 22 deg yaw, got {state}"
    print(f"  -> Case B (Head Panning 22°): {state} ({conf*100:.1f}% confidence) PASS")

    # Case C: Distracted Head Turn (Yaw = 35 deg > 28 deg) -> Distracted
    vec_distracted = np.array([[1.0, 5.0, 35.0, 3.0, 0.27, 0.65]], dtype=np.float32)
    state, conf = predictor.predict(vec_distracted)
    assert state == "Distracted", f"Expected Distracted for 35 deg yaw, got {state}"
    print(f"  -> Case C (Turned Away 35°): {state} ({conf*100:.1f}% confidence) PASS")

    # Case D: Low Engagement / Drowsy (EAR = 0.14 < 0.18) -> Low Engagement
    vec_drowsy = np.array([[1.0, 15.0, 2.0, 0.0, 0.14, 0.12]], dtype=np.float32)
    state, conf = predictor.predict(vec_drowsy)
    assert state == "Low Engagement", f"Expected Low Engagement for 0.14 EAR, got {state}"
    print(f"  -> Case D (Drowsy EAR 0.14): {state} ({conf*100:.1f}% confidence) PASS")

    # Case E: Away (Face not detected) -> Away
    vec_away = np.array([[0.0, 45.0, 45.0, 0.0, 0.0, 1.0]], dtype=np.float32)
    state, conf = predictor.predict(vec_away)
    assert state == "Away", f"Expected Away, got {state}"
    print(f"  -> Case E (No Face / Away): {state} ({conf*100:.1f}% confidence) PASS")

    # Case F: Low Engagement / Slumping (pitch = 30.0 > 25.0, EAR = 0.14 < 0.22) -> Low Engagement
    vec_slumping = np.array([[1.0, 30.0, 2.0, 0.0, 0.14, 0.12]], dtype=np.float32)
    state, conf = predictor.predict(vec_slumping)
    assert state == "Low Engagement", f"Expected Low Engagement for slumping head, got {state}"
    print(f"  -> Case F (Slumping Head + Drowsy): {state} ({conf*100:.1f}% confidence) PASS")

def run_all():
    print("=" * 60)
    print("[LEARNPULSE AI] STANDALONE COMPUTER VISION & ML SUITE")
    print("=" * 60)
    test_mediapipe_detector_fallback()
    test_feature_extractor()
    test_fine_tuned_engagement_predictor_rules()
    print("=" * 60)
    print("[SUCCESS] ALL COMPUTER VISION STANDALONE TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_all()
