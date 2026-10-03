from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TopicBase(BaseModel):
    title: str
    start_time: int
    end_time: int
    description: Optional[str] = ""

class TopicCreate(TopicBase):
    lecture_id: int

class TopicOut(TopicBase):
    id: int
    lecture_id: int

    class Config:
        from_attributes = True

class LectureBase(BaseModel):
    title: str
    video_url: str
    duration_seconds: int = 600

class LectureCreate(LectureBase):
    course_id: int

class LectureOut(LectureBase):
    id: int
    course_id: int
    created_at: Optional[datetime] = None
    topics: List[TopicOut] = []

    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    title: str
    course_code: str
    description: Optional[str] = ""

class CourseCreate(CourseBase):
    teacher_id: Optional[int] = None

class CourseOut(CourseBase):
    id: int
    teacher_id: int
    created_at: Optional[datetime] = None
    lectures: List[LectureOut] = []

    class Config:
        from_attributes = True
