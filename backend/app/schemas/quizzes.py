from pydantic import BaseModel, field_validator
from typing import Optional, List

VALID_OPTIONS = ["A", "B", "C", "D"]

def _normalize_option(v: str) -> str:
    v = (v or "").strip().upper()[:1]
    if v not in VALID_OPTIONS:
        raise ValueError(f"Option must be one of {VALID_OPTIONS}")
    return v

class QuizCreate(BaseModel):
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str] = ""

    @field_validator('correct_option')
    def validate_correct_option(cls, v):
        return _normalize_option(v)

class QuizUpdate(BaseModel):
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: Optional[str] = ""

    @field_validator('correct_option')
    def validate_correct_option(cls, v):
        return _normalize_option(v)

class QuizOut(BaseModel):
    """Quiz as shown to students: the answer key is only included for teachers and admins."""
    id: int
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: Optional[str] = None
    explanation: Optional[str] = None

    class Config:
        from_attributes = True

class QuizSubmit(BaseModel):
    quiz_id: int
    selected_option: str

    @field_validator('selected_option')
    def validate_selected_option(cls, v):
        return _normalize_option(v)

class QuizResultOut(BaseModel):
    quiz_id: int
    is_correct: bool
    score: float
    correct_option: str
    explanation: Optional[str] = None
    topic_quiz_score: Optional[float] = None
    difficulty_score: Optional[float] = None
    difficulty_label: Optional[str] = None
