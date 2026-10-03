from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from ai.revision_generator import AIRevisionGenerator
from backend.app.api.deps import get_current_user
from backend.app.database.session import get_db
from backend.app.database.models import User, Topic, Quiz, Course
from backend.app.services.learning import latest_difficulty, latest_quiz_results, serialize_difficulty

router = APIRouter(prefix="/revision", tags=["AI Revision Generator"])

generator = AIRevisionGenerator()

class RevisionRequest(BaseModel):
    topic_id: Optional[int] = None
    topic_title: Optional[str] = None
    course_title: Optional[str] = None

@router.post("/generate")
def generate_revision_kit(
    data: RevisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    topic = None
    if data.topic_id:
        topic = db.query(Topic).filter(Topic.id == data.topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
    elif not (data.topic_title or "").strip():
        raise HTTPException(status_code=422, detail="Provide topic_id or topic_title")

    topic_title = topic.title if topic else data.topic_title.strip()
    course_title = data.course_title or ""
    description = ""
    quizzes = []
    weak_points = []

    if topic:
        description = topic.description or ""
        course = db.query(Course).filter(Course.id == topic.lecture.course_id).first()
        course_title = course.title if course else course_title

        topic_quizzes = db.query(Quiz).filter(Quiz.topic_id == topic.id).order_by(Quiz.id.asc()).all()
        if current_user.role == "student":
            # Never hand a student the answer key for questions they have not attempted yet
            answered = latest_quiz_results(db, current_user.id, [q.id for q in topic_quizzes])
            topic_quizzes = [q for q in topic_quizzes if q.id in answered]
            weak_points += [f"answered '{q.question}' incorrectly" for q in topic_quizzes if not answered[q.id].is_correct]

        quizzes = [
            {
                "question": q.question,
                "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
                "correct": q.correct_option.upper(),
                "explanation": q.explanation or ""
            }
            for q in topic_quizzes
        ]

        record = latest_difficulty(db, current_user.id, topic.id)
        if record:
            d = serialize_difficulty(record, topic)
            weak_points.append(f"difficulty rated {d['difficulty_label']} ({d['difficulty_score']}/100)")
            if d["quiz_score"] is not None:
                weak_points.append(f"quiz score {d['quiz_score']}%")
            if d["replay_count"]:
                weak_points.append(f"replayed the segment {d['replay_count']} times")

    kit = generator.generate_revision_kit(
        topic_title=topic_title,
        course_title=course_title,
        topic_description=description,
        quizzes=quizzes,
        weak_points=weak_points
    )
    kit["topic_id"] = topic.id if topic else None
    return {"status": "success", "revision_kit": kit}
