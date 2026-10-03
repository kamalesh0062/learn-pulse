from backend.app.database.session import engine, SessionLocal, Base
from backend.app.database.models import (
    User, Course, Lecture, Topic, Quiz, QuizResult, EngagementLog, VideoEvent, Notification
)
from backend.app.core.security import hash_password
from backend.app.services.learning import recompute_topic_difficulty

SAMPLE_VIDEO_1 = "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4"
SAMPLE_VIDEO_2 = "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4"

# Sample videos used by earlier seeds; that Google bucket now returns 403 for every request
DEAD_SAMPLE_VIDEOS = {
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4": SAMPLE_VIDEO_1,
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4": SAMPLE_VIDEO_2,
}

from sqlalchemy import text

def init_and_seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Lightweight column migrations for SQLite databases created by earlier versions
    if engine.dialect.name == "sqlite":
        migrations = [
            ("engagement_logs", "topic_id", "INTEGER REFERENCES topics(id)"),
            ("engagement_logs", "gaze_offset", "REAL DEFAULT 0.0"),
            ("difficulty_scores", "signals", "VARCHAR(100)"),
        ]
        try:
            with engine.connect() as conn:
                for table, column, ddl in migrations:
                    col_names = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table});")).fetchall()]
                    if col_names and column not in col_names:
                        print(f"[INFO] Migrating DB: Adding {column} column to {table}...")
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl};"))
                conn.commit()
        except Exception as m_err:
            print(f"[WARNING] Database migration notice: {m_err}")

    try:
        for dead_url, working_url in DEAD_SAMPLE_VIDEOS.items():
            repaired = db.query(Lecture).filter(Lecture.video_url == dead_url).update({Lecture.video_url: working_url})
            if repaired:
                print(f"[INFO] Replaced unreachable sample video URL on {repaired} lecture(s).")
        db.commit()

        # Check if users exist
        if db.query(User).count() == 0:
            print("[INFO] Seeding initial LearnPulse database records...")
            # Create default users
            teacher1 = User(
                name="Dr. Alan Turing",
                email="alan.turing@university.edu",
                password_hash=hash_password("teacher123"),
                role="teacher",
                department="Computer Science & AI"
            )
            teacher2 = User(
                name="Prof. Ada Lovelace",
                email="ada.lovelace@university.edu",
                password_hash=hash_password("teacher123"),
                role="teacher",
                department="Data Science"
            )
            student1 = User(
                name="Alex Rivera",
                email="alex.rivera@student.edu",
                password_hash=hash_password("student123"),
                role="student",
                enrollment_no="ENR2026001"
            )
            student2 = User(
                name="Sophia Chen",
                email="sophia.chen@student.edu",
                password_hash=hash_password("student123"),
                role="student",
                enrollment_no="ENR2026002"
            )
            admin1 = User(
                name="System Administrator",
                email="admin@learnpulse.ai",
                password_hash=hash_password("admin123"),
                role="admin",
                department="IT Operations"
            )

            db.add_all([teacher1, teacher2, student1, student2, admin1])
            db.commit()

            # Create default courses
            course1 = Course(
                teacher_id=teacher1.id,
                title="Deep Learning & Neural Networks",
                course_code="CS401",
                description="Comprehensive masterclass in deep neural network architectures, backpropagation, and vision systems."
            )
            course2 = Course(
                teacher_id=teacher2.id,
                title="Data Structures & Algorithms",
                course_code="CS201",
                description="Fundamental computer science data structures, graph search algorithms, and space-time complexity analysis."
            )
            db.add_all([course1, course2])
            db.commit()

            # Create default lectures
            lecture1 = Lecture(
                course_id=course1.id,
                title="Lecture 1: Gradient Descent & Backpropagation",
                video_url=SAMPLE_VIDEO_1,
                duration_seconds=600
            )
            lecture2 = Lecture(
                course_id=course1.id,
                title="Lecture 2: Convolutional Neural Networks (CNNs)",
                video_url=SAMPLE_VIDEO_2,
                duration_seconds=654
            )
            db.add_all([lecture1, lecture2])
            db.commit()

            # Create default topics
            t1 = Topic(
                lecture_id=lecture1.id,
                title="Forward Pass & Activation Functions",
                start_time=0,
                end_time=180,
                description="Computing vector dot products and applying non-linear activations (ReLU, Sigmoid)."
            )
            t2 = Topic(
                lecture_id=lecture1.id,
                title="Backpropagation & Chain Rule",
                start_time=181,
                end_time=420,
                description="Calculating loss gradients through intermediate computational graphs."
            )
            t3 = Topic(
                lecture_id=lecture1.id,
                title="Adam Optimizer & Learning Rates",
                start_time=421,
                end_time=600,
                description="Adaptive moment estimation and hyperparameter tuning strategies."
            )
            db.add_all([t1, t2, t3])
            db.commit()

            # Create default quizzes
            q1 = Quiz(
                topic_id=t1.id,
                question="What is the primary purpose of an activation function in a neural network?",
                option_a="To introduce non-linearity into the model",
                option_b="To compress memory consumption",
                option_c="To reduce the training dataset size",
                option_d="To replace weight parameters",
                correct_option="A",
                explanation="Non-linear activation functions allow neural networks to learn complex non-linear decision boundaries."
            )
            q2 = Quiz(
                topic_id=t2.id,
                question="By which calculus rule are gradients propagated backwards through composite functions?",
                option_a="Quotient Rule",
                option_b="Chain Rule",
                option_c="Power Rule",
                option_d="L'Hopital's Rule",
                correct_option="B",
                explanation="The Chain Rule enables calculating partial derivatives of composite loss functions relative to internal weights."
            )
            q3 = Quiz(
                topic_id=t3.id,
                question="Which component does the Adam optimizer combine?",
                option_a="Momentum and RMSProp",
                option_b="SGD and Adagrad",
                option_c="L1 and L2 Regularization",
                option_d="Dropout and Batch Norm",
                correct_option="A",
                explanation="Adam combines exponentially decaying averages of past squared gradients (RMSProp) and past gradients (Momentum)."
            )
            db.add_all([q1, q2, q3])
            db.commit()

            # Demo activity for the first student, scored by the same pipeline as real activity
            # (the second student is left untouched so the empty states can be seen too).
            demo_activity = [
                # (topic, quiz, answer, replays, pauses, focus states of 5-second camera samples)
                (t1, q1, "A", 0, 1, ["Focused"] * 11 + ["Distracted"]),
                (t2, q2, "A", 4, 5, ["Focused"] * 6 + ["Distracted"] * 4 + ["Low Engagement"] * 2),
            ]
            for topic, quiz, answer, replays, pauses, states in demo_activity:
                correct = answer == quiz.correct_option
                db.add(QuizResult(
                    student_id=student1.id, quiz_id=quiz.id, selected_option=answer,
                    is_correct=correct, score=100.0 if correct else 0.0
                ))
                for i in range(replays):
                    db.add(VideoEvent(student_id=student1.id, lecture_id=lecture1.id, event_type="REPLAY", position_seconds=topic.start_time + 10 + i * 20))
                for i in range(pauses):
                    db.add(VideoEvent(student_id=student1.id, lecture_id=lecture1.id, event_type="PAUSE", position_seconds=topic.start_time + 15 + i * 20))
                for i, state in enumerate(states):
                    focused = state == "Focused"
                    db.add(EngagementLog(
                        student_id=student1.id, lecture_id=lecture1.id, topic_id=topic.id,
                        timestamp_seconds=topic.start_time + i * 5, focus_state=state,
                        pitch=2.0 if focused else 12.0, yaw=3.0 if focused else 34.0, roll=0.0,
                        ear=0.30 if state != "Low Engagement" else 0.15,
                        gaze_offset=0.1 if focused else 0.7, confidence=0.95
                    ))
            db.commit()
            for topic, *_ in demo_activity:
                recompute_topic_difficulty(db, student1.id, topic)

            # Add welcome notifications
            notif1 = Notification(
                user_id=student1.id,
                title="Welcome to LearnPulse AI",
                message="Your privacy-first learning analytics portal is active. Start watching your assigned lectures!"
            )
            db.add(notif1)
            
            db.commit()
            print("[SUCCESS] LearnPulse database initialized & seeded successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    init_and_seed_db()
