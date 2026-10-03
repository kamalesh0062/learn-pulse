"""
LearnPulse AI - Analytics Engine Wrapper
"""

from ml.difficulty_engine import DifficultyEngine

class AnalyticsEngine:
    @staticmethod
    def compute_difficulty(eng_score, quiz_score, replays, pauses, watch_ratio=1.0):
        return DifficultyEngine.calculate_difficulty(eng_score, quiz_score, replays, pauses, watch_ratio)
