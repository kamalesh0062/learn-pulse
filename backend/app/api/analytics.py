from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from backend.app.database.session import get_db
from backend.app.database.models import (
    User, Course, Lecture, Topic, Quiz, EngagementLog, DifficultyScore, VideoEvent
)
from backend.app.api.deps import get_current_user, get_current_teacher
from backend.app.services.learning import (
    student_analytics, focus_percentage, latest_quiz_results, utc_now, HARD_LABELS
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

ALERT_WINDOW_MINUTES = 10
ALERT_MIN_SAMPLES = 5
ALERT_NON_FOCUSED_RATIO = 0.35
AT_RISK_DIFFICULTY = 56.0
AT_RISK_ENGAGEMENT = 50.0

def _mean(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 1) if values else None

def _teacher_lectures(db: Session, user: User) -> List[Lecture]:
    """Lectures a teacher can see analytics for: their own courses (admins see everything)."""
    query = db.query(Lecture).join(Course, Lecture.course_id == Course.id)
    if user.role != "admin":
        query = query.filter(Course.teacher_id == user.id)
    return query.order_by(Lecture.id.asc()).all()

@router.get("/student")
def get_student_analytics(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = current_user.id
    if student_id and student_id != current_user.id:
        if current_user.role not in ["teacher", "admin"]:
            raise HTTPException(status_code=403, detail="You can only view your own analytics")
        target = db.query(User).filter(User.id == student_id, User.role == "student").first()
        if not target:
            raise HTTPException(status_code=404, detail="Student not found")
        target_id = target.id

    data = student_analytics(db, target_id)
    target_user = db.query(User).filter(User.id == target_id).first()
    data["student_name"] = target_user.name if target_user else None
    return data

@router.get("/teacher")
def get_teacher_analytics(
    lecture_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    lectures = _teacher_lectures(db, current_user)
    lecture_ids = [l.id for l in lectures]
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_({l.course_id for l in lectures})).all()} if lectures else {}
    lecture_options = [
        {"id": l.id, "title": l.title, "course_id": l.course_id, "course_title": courses[l.course_id].title if l.course_id in courses else None}
        for l in lectures
    ]

    if lecture_id is not None and lecture_id not in lecture_ids:
        raise HTTPException(status_code=404, detail="Lecture not found among your courses")

    if lecture_id is None and lecture_ids:
        # Default to the lecture with the most recent student activity, else the first one
        last_log = db.query(EngagementLog).filter(
            EngagementLog.lecture_id.in_(lecture_ids)
        ).order_by(EngagementLog.id.desc()).first()
        lecture_id = last_log.lecture_id if last_log else lecture_ids[0]

    lecture = next((l for l in lectures if l.id == lecture_id), None)
    student_ids = {r[0] for r in db.query(User.id).filter(User.role == "student").all()}
    students = {u.id: u for u in db.query(User).filter(User.role == "student").all()}

    empty = {
        "lectures": lecture_options,
        "lecture": None,
        "total_students": len(student_ids),
        "active_students": 0,
        "total_courses": len(courses),
        "average_engagement": None,
        "average_quiz_score": None,
        "hardest_topic": None,
        "students_at_risk_count": 0,
        "students_at_risk": [],
        "state_breakdown": {"Focused": 0, "Distracted": 0, "Low Engagement": 0, "Away": 0},
        "engagement_alert": None,
        "topic_summaries": []
    }
    if not lecture:
        return empty

    topics = db.query(Topic).filter(Topic.lecture_id == lecture.id).order_by(Topic.start_time.asc()).all()
    topic_by_id = {t.id: t for t in topics}

    lecture_logs = [
        log for log in db.query(EngagementLog).filter(EngagementLog.lecture_id == lecture.id).all()
        if log.student_id in student_ids
    ]

    # Latest difficulty record per (student, topic)
    records = db.query(DifficultyScore).filter(
        DifficultyScore.lecture_id == lecture.id
    ).order_by(DifficultyScore.id.asc()).all()
    latest: Dict[Any, DifficultyScore] = {}
    for record in records:
        if record.student_id in student_ids and record.topic_id in topic_by_id:
            latest[(record.student_id, record.topic_id)] = record

    def _signals(record: DifficultyScore) -> List[str]:
        return record.signals.split(",") if record.signals is not None else ["engagement", "quiz", "video"]

    topic_summaries = []
    for t in topics:
        topic_records = [r for (sid, tid), r in latest.items() if tid == t.id]
        topic_logs = [log for log in lecture_logs if log.topic_id == t.id]
        topic_summaries.append({
            "topic_id": t.id,
            "topic_title": t.title,
            "start_time": t.start_time,
            "end_time": t.end_time,
            "avg_difficulty": _mean([r.difficulty_score for r in topic_records]),
            "avg_engagement": focus_percentage(topic_logs) if topic_logs else _mean(
                [r.engagement_score for r in topic_records if "engagement" in _signals(r)]
            ),
            "avg_quiz_score": _mean([r.quiz_score for r in topic_records if "quiz" in _signals(r)]),
            "total_replays": sum(r.replay_count for r in topic_records),
            "total_pauses": sum(r.pause_count for r in topic_records),
            "student_count": len(topic_records),
            "quiz_count": db.query(Quiz).filter(Quiz.topic_id == t.id).count()
        })

    # Cohort quiz average: latest answer per student per question in this lecture
    quiz_ids = [r[0] for r in db.query(Quiz.id).join(Topic, Quiz.topic_id == Topic.id).filter(Topic.lecture_id == lecture.id).all()]
    quiz_scores: List[float] = []
    for sid in student_ids:
        quiz_scores += [r.score for r in latest_quiz_results(db, sid, quiz_ids).values()]

    # Per-student rollup and at-risk detection
    active_ids = {log.student_id for log in lecture_logs} | {sid for (sid, _) in latest.keys()}
    active_ids |= {
        r[0] for r in db.query(VideoEvent.student_id).filter(VideoEvent.lecture_id == lecture.id).distinct().all()
        if r[0] in student_ids
    }
    at_risk = []
    for sid in sorted(active_ids):
        student_records = [r for (rsid, _), r in latest.items() if rsid == sid]
        avg_difficulty = _mean([r.difficulty_score for r in student_records])
        engagement = focus_percentage([log for log in lecture_logs if log.student_id == sid])
        hard_topics = [topic_by_id[r.topic_id].title for r in student_records if r.difficulty_label in HARD_LABELS]

        reasons = []
        if avg_difficulty is not None and avg_difficulty >= AT_RISK_DIFFICULTY:
            reasons.append(f"average topic difficulty {avg_difficulty}/100")
        if engagement is not None and engagement < AT_RISK_ENGAGEMENT:
            reasons.append(f"visual engagement {engagement}%")
        if reasons:
            at_risk.append({
                "student_id": sid,
                "name": students[sid].name,
                "avg_difficulty": avg_difficulty,
                "engagement": engagement,
                "difficult_topics": hard_topics,
                "reasons": reasons
            })

    state_breakdown = {"Focused": 0, "Distracted": 0, "Low Engagement": 0, "Away": 0}
    for log in lecture_logs:
        if log.focus_state in state_breakdown:
            state_breakdown[log.focus_state] += 1

    # Engagement drop alert over the last few minutes of real time
    engagement_alert = None
    cutoff = utc_now() - timedelta(minutes=ALERT_WINDOW_MINUTES)
    recent = [log for log in lecture_logs if log.logged_at is not None and log.logged_at.replace(tzinfo=None) >= cutoff]
    if len(recent) >= ALERT_MIN_SAMPLES:
        non_focused = [log for log in recent if log.focus_state != "Focused"]
        low_ratio = len(non_focused) / len(recent)
        if low_ratio > ALERT_NON_FOCUSED_RATIO:
            topic_counts: Dict[int, int] = {}
            for log in non_focused:
                if log.topic_id in topic_by_id:
                    topic_counts[log.topic_id] = topic_counts.get(log.topic_id, 0) + 1
            worst_topic = topic_by_id[max(topic_counts, key=topic_counts.get)] if topic_counts else None
            engagement_alert = {
                "title": "Potential Engagement Drop Detected",
                "lecture": lecture.title,
                "topic": worst_topic.title if worst_topic else None,
                "drop_percentage": round(low_ratio * 100, 1),
                "message": f"{round(low_ratio * 100, 1)}% of engagement samples in the last {ALERT_WINDOW_MINUTES} minutes were not focused."
            }

    with_data = [t for t in topic_summaries if t["avg_difficulty"] is not None]
    hardest = max(with_data, key=lambda t: t["avg_difficulty"]) if with_data else None

    return {
        **empty,
        "lecture": {"id": lecture.id, "title": lecture.title, "course_id": lecture.course_id},
        "active_students": len(active_ids),
        "average_engagement": focus_percentage(lecture_logs),
        "average_quiz_score": _mean(quiz_scores),
        "hardest_topic": hardest["topic_title"] if hardest else None,
        "students_at_risk_count": len(at_risk),
        "students_at_risk": at_risk,
        "state_breakdown": state_breakdown,
        "engagement_alert": engagement_alert,
        "topic_summaries": topic_summaries
    }

@router.get("/students")
def get_student_roster(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Per-student summary across the teacher's courses."""
    lecture_ids = [l.id for l in _teacher_lectures(db, current_user)]
    roster = []
    for student in db.query(User).filter(User.role == "student").order_by(User.name.asc()).all():
        records = db.query(DifficultyScore).filter(
            DifficultyScore.student_id == student.id,
            DifficultyScore.lecture_id.in_(lecture_ids)
        ).order_by(DifficultyScore.id.asc()).all() if lecture_ids else []
        latest = {r.topic_id: r for r in records}
        logs = db.query(EngagementLog).filter(
            EngagementLog.student_id == student.id,
            EngagementLog.lecture_id.in_(lecture_ids)
        ).all() if lecture_ids else []
        if not latest and not logs:
            continue
        roster.append({
            "student_id": student.id,
            "name": student.name,
            "email": student.email,
            "enrollment_no": student.enrollment_no,
            "topics_tracked": len(latest),
            "avg_difficulty": _mean([r.difficulty_score for r in latest.values()]),
            "engagement": focus_percentage(logs),
            "difficult_topic_count": sum(1 for r in latest.values() if r.difficulty_label in HARD_LABELS)
        })
    return roster
