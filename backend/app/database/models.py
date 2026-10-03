from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.app.database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="student") # student, teacher, admin
    department = Column(String(255), nullable=True)
    enrollment_no = Column(String(255), nullable=True)
    camera_consent = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    course_code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lectures = relationship("Lecture", back_populates="course", cascade="all, delete-orphan")

class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    video_url = Column(Text, nullable=False)
    duration_seconds = Column(Integer, default=600)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="lectures")
    topics = relationship("Topic", back_populates="lecture", cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    start_time = Column(Integer, nullable=False, default=0)
    end_time = Column(Integer, nullable=False, default=180)
    description = Column(Text, nullable=True)

    lecture = relationship("Lecture", back_populates="topics")
    quizzes = relationship("Quiz", back_populates="topic", cascade="all, delete-orphan")

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_option = Column(String(1), nullable=False)
    explanation = Column(Text, nullable=True)

    topic = relationship("Topic", back_populates="quizzes")

class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    selected_option = Column(String(1), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    score = Column(Float, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

class VideoEvent(Base):
    __tablename__ = "video_events"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False) # PLAY, PAUSE, SEEK, REPLAY, COMPLETE
    position_seconds = Column(Integer, nullable=False, default=0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class EngagementLog(Base):
    __tablename__ = "engagement_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp_seconds = Column(Float, nullable=False)
    focus_state = Column(String(50), nullable=False) # Focused, Distracted, Low Engagement, Away
    pitch = Column(Float, default=0.0)
    yaw = Column(Float, default=0.0)
    roll = Column(Float, default=0.0)
    ear = Column(Float, default=0.0)
    gaze_offset = Column(Float, default=0.0)
    confidence = Column(Float, default=1.0)
    logged_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class DifficultyScore(Base):
    __tablename__ = "difficulty_scores"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    engagement_score = Column(Float, nullable=False)
    quiz_score = Column(Float, nullable=False)
    replay_count = Column(Integer, default=0)
    pause_count = Column(Integer, default=0)
    watch_time_ratio = Column(Float, default=1.0)
    difficulty_score = Column(Float, nullable=False)
    difficulty_label = Column(String(50), nullable=False) # Easy, Moderate, Difficult, Very Difficult
    signals = Column(String(100), nullable=True) # Comma-separated signals actually observed: engagement,quiz,video
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
