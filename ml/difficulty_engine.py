"""
LearnPulse AI - Difficulty Engine
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Optional, Tuple
from config import WEIGHT_VISUAL_ENGAGEMENT, WEIGHT_QUIZ_SCORE, WEIGHT_REPLAY_COUNT, WEIGHT_PAUSE_COUNT, WEIGHT_WATCH_RATIO

class DifficultyEngine:
    @staticmethod
    def calculate_difficulty(
        engagement_score: Optional[float],
        quiz_score: Optional[float],
        replay_count: int,
        pause_count: int,
        watch_time_ratio: Optional[float] = 1.0
    ) -> Tuple[float, str]:
        """
        Weighted understanding index (0-100) inverted into a difficulty score.
        Signals that have not been observed yet (None) are left out and the remaining
        weights are renormalized, so a missing camera or an unattempted quiz is never
        scored as if it were a real measurement.
        """
        replay_penalty = min(100.0, (max(0, replay_count) / 3.0) * 100.0)
        pause_penalty = min(100.0, (max(0, pause_count) / 4.0) * 100.0)

        # (weight, 0-100 component score) for every signal that is available
        components = [
            (WEIGHT_REPLAY_COUNT, 100.0 - replay_penalty),
            (WEIGHT_PAUSE_COUNT, 100.0 - pause_penalty),
        ]
        if engagement_score is not None:
            components.append((WEIGHT_VISUAL_ENGAGEMENT, max(0.0, min(100.0, float(engagement_score)))))
        if quiz_score is not None:
            components.append((WEIGHT_QUIZ_SCORE, max(0.0, min(100.0, float(quiz_score)))))
        if watch_time_ratio is not None:
            if watch_time_ratio > 1.5:
                watch_score = 50.0
            elif watch_time_ratio < 0.6:
                watch_score = 40.0
            else:
                watch_score = 100.0
            components.append((WEIGHT_WATCH_RATIO, watch_score))

        total_weight = sum(w for w, _ in components)
        understanding_index = sum(w * v for w, v in components) / total_weight

        understanding_index = max(0.0, min(100.0, understanding_index))
        difficulty_score = round(100.0 - understanding_index, 1)

        if difficulty_score <= 30.0:
            label = "Easy"
        elif difficulty_score <= 55.0:
            label = "Moderate"
        elif difficulty_score <= 75.0:
            label = "Difficult"
        else:
            label = "Very Difficult"

        return difficulty_score, label

    @staticmethod
    def get_difficulty_color(label: str) -> str:
        colors = {"Easy": "#10B981", "Moderate": "#3B82F6", "Difficult": "#F59E0B", "Very Difficult": "#EF4444"}
        return colors.get(label, "#6B7280")
