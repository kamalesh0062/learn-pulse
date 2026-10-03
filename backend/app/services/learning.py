"""
LearnPulse AI - Learning Analytics Service
Single place where raw activity (camera engagement logs, quiz answers, video events)
is turned into per-topic difficulty scores and the aggregates shown on dashboards.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.database.models import (
    Course, Lecture, Topic, Quiz, QuizResult,
    EngagementLog, DifficultyScore, VideoEvent, Notification
)
from ml.difficulty_engine import DifficultyEngine

STATE_SCORES = {"Focused": 100, "Low Engagement": 60, "Distracted": 20, "Away": 0}
HARD_LABELS = ["Difficult", "Very Difficult"]
ENGAGEMENT_SAMPLE_SECONDS = 5  # the browser posts one aggregated engagement event every 5 seconds
MIN_ENGAGEMENT_SAMPLES = 3


def _utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def focus_percentage(logs: List[EngagementLog]) -> Optional[float]:
    if not logs:
        return None
    focused = sum(1 for log in logs if log.focus_state == "Focused")
    return round((focused / len(logs)) * 100, 1)


def topic_for_position(db: Session, lecture_id: int, position_seconds: float) -> Optional[Topic]:
    return db.query(Topic).filter(
        Topic.lecture_id == lecture_id,
        Topic.start_time <= position_seconds,
        Topic.end_time >= position_seconds
    ).order_by(Topic.start_time.asc()).first()


def latest_quiz_results(db: Session, student_id: int, quiz_ids: List[int]) -> Dict[int, QuizResult]:
    """Most recent answer per quiz question for one student."""
    if not quiz_ids:
        return {}
    results = db.query(QuizResult).filter(
        QuizResult.student_id == student_id,
        QuizResult.quiz_id.in_(quiz_ids)
    ).order_by(QuizResult.id.asc()).all()
    return {r.quiz_id: r for r in results}


def topic_quiz_score(db: Session, student_id: int, topic_id: int) -> Optional[float]:
    quiz_ids = [q.id for q in db.query(Quiz.id).filter(Quiz.topic_id == topic_id).all()]
    latest = latest_quiz_results(db, student_id, quiz_ids)
    if not latest:
        return None
    return round(sum(r.score for r in latest.values()) / len(latest), 1)


def latest_difficulty(db: Session, student_id: int, topic_id: int) -> Optional[DifficultyScore]:
    return db.query(DifficultyScore).filter(
        DifficultyScore.student_id == student_id,
        DifficultyScore.topic_id == topic_id
    ).order_by(DifficultyScore.id.desc()).first()


def recompute_topic_difficulty(db: Session, student_id: int, topic: Topic) -> Optional[DifficultyScore]:
    """
    Recalculates and upserts one student's difficulty score for one topic from real activity.
    Returns None when the student has no activity on the topic yet.
    """
    logs = db.query(EngagementLog).filter(
        EngagementLog.student_id == student_id,
        EngagementLog.topic_id == topic.id
    ).all()
    engagement = focus_percentage(logs) if len(logs) >= MIN_ENGAGEMENT_SAMPLES else None
    quiz = topic_quiz_score(db, student_id, topic.id)

    events = db.query(VideoEvent).filter(
        VideoEvent.student_id == student_id,
        VideoEvent.lecture_id == topic.lecture_id,
        VideoEvent.position_seconds >= topic.start_time,
        VideoEvent.position_seconds <= topic.end_time
    ).all()
    replays = sum(1 for e in events if e.event_type == "REPLAY")
    pauses = sum(1 for e in events if e.event_type == "PAUSE")

    if engagement is None and quiz is None and not events:
        return None

    topic_duration = max(1, topic.end_time - topic.start_time)
    watch_ratio = None
    if engagement is not None:
        watch_ratio = round(min(3.0, (len(logs) * ENGAGEMENT_SAMPLE_SECONDS) / topic_duration), 2)

    score, label = DifficultyEngine.calculate_difficulty(
        engagement_score=engagement,
        quiz_score=quiz,
        replay_count=replays,
        pause_count=pauses,
        watch_time_ratio=watch_ratio
    )

    signals = [name for name, present in [
        ("engagement", engagement is not None),
        ("quiz", quiz is not None),
        ("video", bool(events)),
    ] if present]

    record = latest_difficulty(db, student_id, topic.id)
    previous_label = record.difficulty_label if record else None
    if record is None:
        record = DifficultyScore(student_id=student_id, lecture_id=topic.lecture_id, topic_id=topic.id)
        db.add(record)

    record.engagement_score = engagement if engagement is not None else 0.0
    record.quiz_score = quiz if quiz is not None else 0.0
    record.replay_count = replays
    record.pause_count = pauses
    record.watch_time_ratio = watch_ratio if watch_ratio is not None else 1.0
    record.difficulty_score = score
    record.difficulty_label = label
    record.signals = ",".join(signals)
    record.calculated_at = utc_now()

    if label in HARD_LABELS and previous_label not in HARD_LABELS:
        db.add(Notification(
            user_id=student_id,
            title="AI Revision Recommendation",
            message=f"'{topic.title}' is currently rated {label} for you. Generate an AI Revision Kit to review it."
        ))

    db.commit()
    db.refresh(record)
    return record


def serialize_difficulty(record: DifficultyScore, topic: Optional[Topic], lecture: Optional[Lecture] = None) -> Dict[str, Any]:
    # Rows written before the signals column existed are treated as fully observed
    signals = record.signals.split(",") if record.signals is not None else ["engagement", "quiz", "video"]
    return {
        "topic_id": record.topic_id,
        "lecture_id": record.lecture_id,
        "topic_title": topic.title if topic else f"Topic {record.topic_id}",
        "lecture_title": lecture.title if lecture else None,
        "difficulty_score": record.difficulty_score,
        "difficulty_label": record.difficulty_label,
        "color": DifficultyEngine.get_difficulty_color(record.difficulty_label),
        "quiz_score": record.quiz_score if "quiz" in signals else None,
        "engagement_score": record.engagement_score if "engagement" in signals else None,
        "replay_count": record.replay_count,
        "pause_count": record.pause_count,
        "watch_time_ratio": record.watch_time_ratio if "engagement" in signals else None,
        "calculated_at": record.calculated_at.isoformat() if record.calculated_at else None
    }


def student_topic_difficulties(db: Session, student_id: int) -> List[Dict[str, Any]]:
    """Latest difficulty record per topic for a student, hardest first."""
    records = db.query(DifficultyScore).filter(
        DifficultyScore.student_id == student_id
    ).order_by(DifficultyScore.id.asc()).all()
    latest = {r.topic_id: r for r in records}

    topics = {t.id: t for t in db.query(Topic).filter(Topic.id.in_(latest.keys())).all()} if latest else {}
    lecture_ids = {t.lecture_id for t in topics.values()}
    lectures = {l.id: l for l in db.query(Lecture).filter(Lecture.id.in_(lecture_ids)).all()} if lecture_ids else {}

    items = []
    for topic_id, record in latest.items():
        topic = topics.get(topic_id)
        if not topic:
            continue  # topic was deleted
        items.append(serialize_difficulty(record, topic, lectures.get(topic.lecture_id)))
    items.sort(key=lambda d: d["difficulty_score"], reverse=True)
    return items


def study_streak_days(db: Session, student_id: int) -> int:
    """Consecutive days (UTC) with any learning activity, ending today or yesterday."""
    stamps: List[Optional[datetime]] = []
    stamps += [r[0] for r in db.query(QuizResult.submitted_at).filter(QuizResult.student_id == student_id).all()]
    stamps += [r[0] for r in db.query(EngagementLog.logged_at).filter(EngagementLog.student_id == student_id).all()]
    stamps += [r[0] for r in db.query(VideoEvent.timestamp).filter(VideoEvent.student_id == student_id).all()]
    days = {_utc_naive(s).date() for s in stamps if s is not None}
    if not days:
        return 0

    today = utc_now().date()
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def course_progress(db: Session, student_id: int) -> float:
    """
    Share of topics completed in the courses the student has started.
    A topic counts as completed once every quiz question in it has been answered,
    or (for topics without quizzes) once the student has watched part of it.
    """
    touched_lecture_ids = {r[0] for r in db.query(VideoEvent.lecture_id).filter(VideoEvent.student_id == student_id).distinct().all()}
    touched_lecture_ids |= {r[0] for r in db.query(EngagementLog.lecture_id).filter(EngagementLog.student_id == student_id).distinct().all()}
    touched_lecture_ids |= {r[0] for r in db.query(DifficultyScore.lecture_id).filter(DifficultyScore.student_id == student_id).distinct().all()}
    if not touched_lecture_ids:
        return 0.0

    course_ids = {r[0] for r in db.query(Lecture.course_id).filter(Lecture.id.in_(touched_lecture_ids)).all()}
    topics = db.query(Topic).join(Lecture, Topic.lecture_id == Lecture.id).filter(Lecture.course_id.in_(course_ids)).all()
    if not topics:
        return 0.0

    watched_topic_ids = {r[0] for r in db.query(EngagementLog.topic_id).filter(
        EngagementLog.student_id == student_id, EngagementLog.topic_id.isnot(None)
    ).distinct().all()}

    completed = 0
    for topic in topics:
        quiz_ids = [q.id for q in db.query(Quiz.id).filter(Quiz.topic_id == topic.id).all()]
        if quiz_ids:
            if len(latest_quiz_results(db, student_id, quiz_ids)) == len(quiz_ids):
                completed += 1
        elif topic.id in watched_topic_ids:
            completed += 1
    return round((completed / len(topics)) * 100, 1)


def engagement_timeline(db: Session, student_id: int, bucket_seconds: int = 30) -> Dict[str, Any]:
    """Average engagement per 30-second slice of the lecture the student watched most recently."""
    last_log = db.query(EngagementLog).filter(
        EngagementLog.student_id == student_id
    ).order_by(EngagementLog.id.desc()).first()
    if not last_log:
        return {"lecture_id": None, "lecture_title": None, "points": []}

    lecture = db.query(Lecture).filter(Lecture.id == last_log.lecture_id).first()
    logs = db.query(EngagementLog).filter(
        EngagementLog.student_id == student_id,
        EngagementLog.lecture_id == last_log.lecture_id
    ).all()

    buckets: Dict[int, List[EngagementLog]] = {}
    for log in logs:
        buckets.setdefault(int(log.timestamp_seconds // bucket_seconds), []).append(log)

    points = []
    for bucket in sorted(buckets):
        bucket_logs = buckets[bucket]
        counts: Dict[str, int] = {}
        for log in bucket_logs:
            counts[log.focus_state] = counts.get(log.focus_state, 0) + 1
        start = bucket * bucket_seconds
        points.append({
            "time": f"{start // 60}:{start % 60:02d}",
            "score": round(sum(STATE_SCORES.get(l.focus_state, 0) for l in bucket_logs) / len(bucket_logs), 1),
            "focus_state": max(counts, key=counts.get),
            "samples": len(bucket_logs)
        })
    return {
        "lecture_id": last_log.lecture_id,
        "lecture_title": lecture.title if lecture else None,
        "points": points
    }


def student_analytics(db: Session, student_id: int) -> Dict[str, Any]:
    quiz_ids = [r[0] for r in db.query(QuizResult.quiz_id).filter(QuizResult.student_id == student_id).distinct().all()]
    latest = latest_quiz_results(db, student_id, quiz_ids)
    quiz_average = round(sum(r.score for r in latest.values()) / len(latest), 1) if latest else None

    logs = db.query(EngagementLog).filter(EngagementLog.student_id == student_id).all()
    engagement = focus_percentage(logs)

    available = [v for v in [quiz_average, engagement] if v is not None]
    overall = round(sum(available) / len(available), 1) if available else None

    topics = student_topic_difficulties(db, student_id)
    hardest = next((t for t in topics if t["difficulty_label"] in HARD_LABELS), None)

    if hardest:
        reasons = []
        if hardest["quiz_score"] is not None:
            reasons.append(f"quiz score {hardest['quiz_score']}%")
        if hardest["engagement_score"] is not None:
            reasons.append(f"visual engagement {hardest['engagement_score']}%")
        if hardest["replay_count"]:
            reasons.append(f"{hardest['replay_count']} replays")
        if hardest["pause_count"]:
            reasons.append(f"{hardest['pause_count']} pauses")
        recommendation = f"Review '{hardest['topic_title']}' ({hardest['difficulty_label']}, {hardest['difficulty_score']}/100)"
        recommendation += f": {', '.join(reasons)}." if reasons else "."
    elif topics:
        recommendation = "No topic is currently rated Difficult for you. Keep going with the next lecture."
    else:
        recommendation = "Watch a lecture and answer its topic quizzes to get a personalised recommendation."

    return {
        "student_id": student_id,
        "overall_learning_score": overall,
        "engagement_score": engagement,
        "quiz_average": quiz_average,
        "quizzes_answered": len(latest),
        "engagement_samples": len(logs),
        "course_progress": course_progress(db, student_id),
        "study_streak_days": study_streak_days(db, student_id),
        "difficult_topics": topics,
        "focus_topic": hardest,
        "engagement_timeline": engagement_timeline(db, student_id),
        "recommendation": recommendation
    }
