"""
LearnPulse AI - Machine Learning Model Trainer
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pickle
from typing import Tuple
from config import MODEL_PATH

def generate_synthetic_dataset(num_samples: int = 4000) -> Tuple[np.ndarray, np.ndarray]:
    np.random.seed(42)
    samples_per_class = num_samples // 4

    # Class 0: Focused (with realistic laptop camera angles & wide monitor panning)
    f_face = np.ones((samples_per_class, 1))
    f_pitch = np.random.normal(2.0, 7.5, (samples_per_class, 1))  # Slight downward tilt for laptops
    f_yaw = np.random.normal(0.0, 10.0, (samples_per_class, 1))  # Panning across screen
    f_roll = np.random.normal(0.0, 4.0, (samples_per_class, 1))
    f_ear = np.random.normal(0.29, 0.035, (samples_per_class, 1)) # Open eyes
    f_gaze = np.random.exponential(0.08, (samples_per_class, 1))
    class_0 = np.hstack([f_face, f_pitch, f_yaw, f_roll, f_ear, f_gaze])
    y_0 = np.zeros(samples_per_class)

    # Class 1: Distracted (Head turned >28 deg or pitch >25 deg or gaze away)
    d_face = np.ones((samples_per_class, 1))
    d_pitch = np.random.choice([-1, 1], (samples_per_class, 1)) * np.random.uniform(26, 50, (samples_per_class, 1))
    d_yaw = np.random.choice([-1, 1], (samples_per_class, 1)) * np.random.uniform(30, 65, (samples_per_class, 1))
    d_roll = np.random.normal(0.0, 12.0, (samples_per_class, 1))
    d_ear = np.random.normal(0.27, 0.04, (samples_per_class, 1))
    d_gaze = np.random.uniform(0.56, 1.2, (samples_per_class, 1))
    class_1 = np.hstack([d_face, d_pitch, d_yaw, d_roll, d_ear, d_gaze])
    y_1 = np.ones(samples_per_class)

    # Class 2: Low Engagement (Sustained low EAR < 0.18 or severe downward slump)
    l_face = np.ones((samples_per_class, 1))
    l_pitch = np.random.uniform(26.0, 45.0, (samples_per_class, 1))
    l_yaw = np.random.normal(0.0, 10.0, (samples_per_class, 1))
    l_roll = np.random.normal(0.0, 6.0, (samples_per_class, 1))
    l_ear = np.random.uniform(0.06, 0.17, (samples_per_class, 1)) # Drooping/closed eyes
    l_gaze = np.random.uniform(0.1, 0.4, (samples_per_class, 1))
    class_2 = np.hstack([l_face, l_pitch, l_yaw, l_roll, l_ear, l_gaze])
    y_2 = np.full(samples_per_class, 2)

    # Class 3: Away (No face detected)
    a_face = np.zeros((samples_per_class, 1))
    a_pitch = np.full((samples_per_class, 1), 45.0)
    a_yaw = np.full((samples_per_class, 1), 45.0)
    a_roll = np.zeros((samples_per_class, 1))
    a_ear = np.zeros((samples_per_class, 1))
    a_gaze = np.ones((samples_per_class, 1))
    class_3 = np.hstack([a_face, a_pitch, a_yaw, a_roll, a_ear, a_gaze])
    y_3 = np.full(samples_per_class, 3)

    X = np.vstack([class_0, class_1, class_2, class_3])
    y = np.concatenate([y_0, y_1, y_2, y_3])

    return X, y

def train_and_save_model():
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score

        print("[INFO] Generating fine-tuned synthetic training data for Random Forest Classifier...")
        X, y = generate_synthetic_dataset(num_samples=4000)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        print("[INFO] Training Random Forest Classifier...")
        clf = RandomForestClassifier(n_estimators=150, max_depth=10, min_samples_leaf=2, random_state=42)
        clf.fit(X_train, y_train)

        accuracy = accuracy_score(y_test, clf.predict(X_test))
        print(f"[SUCCESS] Model Accuracy: {accuracy * 100:.2f}%")

        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(clf, f)

        print(f"[SUCCESS] Trained model saved to {MODEL_PATH}")
        return clf
    except Exception as e:
        print(f"[WARNING] Could not train Scikit-Learn model due to binary mismatch: {e}")
        return None

if __name__ == "__main__":
    train_and_save_model()
