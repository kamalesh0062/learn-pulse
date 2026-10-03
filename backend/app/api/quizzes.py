from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database.session import get_db
from backend.app.database.models import Quiz, QuizResult, Topic, User
from backend.app.schemas.quizzes import QuizCreate, QuizUpdate, QuizOut, QuizSubmit, QuizResultOut
from backend.app.api.deps import get_current_user, get_current_teacher, ensure_topic_owner
from backend.app.services.learning import recompute_topic_difficulty, topic_quiz_score

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])

@router.get("", response_model=List[QuizOut])
def get_quizzes(
    topic_id: Optional[int] = None,
    lecture_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Quiz)
    if topic_id:
        query = query.filter(Quiz.topic_id == topic_id)
    if lecture_id:
        query = query.join(Topic, Quiz.topic_id == Topic.id).filter(Topic.lecture_id == lecture_id)
    quizzes = query.order_by(Quiz.id.asc()).all()

    # Students never receive the answer key before submitting
    if current_user.role == "student":
        return [
            QuizOut(
                id=q.id, topic_id=q.topic_id, question=q.question,
                option_a=q.option_a, option_b=q.option_b, option_c=q.option_c, option_d=q.option_d
            )
            for q in quizzes
        ]
    return quizzes

@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(
    data: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    topic = db.query(Topic).filter(Topic.id == data.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    ensure_topic_owner(db, topic, current_user)

    quiz = Quiz(
        topic_id=data.topic_id,
        question=data.question,
        option_a=data.option_a,
        option_b=data.option_b,
        option_c=data.option_c,
        option_d=data.option_d,
        correct_option=data.correct_option,
        explanation=data.explanation
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.put("/{quiz_id}", response_model=QuizOut)
def update_quiz(
    quiz_id: int,
    data: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz question not found")
    ensure_topic_owner(db, quiz.topic, current_user)

    quiz.question = data.question
    quiz.option_a = data.option_a
    quiz.option_b = data.option_b
    quiz.option_c = data.option_c
    quiz.option_d = data.option_d
    quiz.correct_option = data.correct_option
    quiz.explanation = data.explanation
    db.commit()
    db.refresh(quiz)
    return quiz

@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz question not found")
    ensure_topic_owner(db, quiz.topic, current_user)

    db.query(QuizResult).filter(QuizResult.quiz_id == quiz_id).delete()
    db.delete(quiz)
    db.commit()
    return {"status": "success", "message": "Quiz question deleted"}

@router.post("/submit", response_model=QuizResultOut)
def submit_quiz_answer(
    data: QuizSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    quiz = db.query(Quiz).filter(Quiz.id == data.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz question not found")

    is_correct = (data.selected_option == quiz.correct_option.upper())
    score = 100.0 if is_correct else 0.0

    result = QuizResult(
        student_id=current_user.id,
        quiz_id=quiz.id,
        selected_option=data.selected_option,
        is_correct=is_correct,
        score=score
    )
    db.add(result)
    db.commit()

    # Quiz answers feed straight into the topic's difficulty score
    difficulty = recompute_topic_difficulty(db, current_user.id, quiz.topic)

    return {
        "quiz_id": quiz.id,
        "is_correct": is_correct,
        "score": score,
        "correct_option": quiz.correct_option.upper(),
        "explanation": quiz.explanation,
        "topic_quiz_score": topic_quiz_score(db, current_user.id, quiz.topic_id),
        "difficulty_score": difficulty.difficulty_score if difficulty else None,
        "difficulty_label": difficulty.difficulty_label if difficulty else None
    }
