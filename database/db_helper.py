"""
LearnPulse AI - Database Helper & DAO Layer
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
from typing import List, Dict, Any, Optional
from database.schema import get_db_connection, hash_password, verify_password

def register_user(name: str, email: str, password: str, role: str = "student", extra_info: str = "") -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    pwd_hash = hash_password(password)

    try:
        if role.lower() == "teacher":
            cursor.execute(
                "INSERT INTO teachers (name, email, password_hash, department) VALUES (?, ?, ?, ?)",
                (name, email, pwd_hash, extra_info or "Computer Science")
            )
        else:
            cursor.execute(
                "INSERT INTO students (name, email, password_hash, enrollment_no) VALUES (?, ?, ?, ?)",
                (name, email, pwd_hash, extra_info or f"ENR{cursor.lastrowid or 1001}")
            )
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "name": name, "email": email, "role": role.lower()}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def authenticate_user(email: str, password: str, role: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    table = "teachers" if role.lower() == "teacher" else "students"

    cursor.execute(f"SELECT * FROM {table} WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if user and verify_password(password, user["password_hash"]):
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": role.lower()
        }
    return None

def create_course(teacher_id: int, title: str, course_code: str, description: str = "") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO courses (teacher_id, title, course_code, description) VALUES (?, ?, ?, ?)",
        (teacher_id, title, course_code, description)
    )
    conn.commit()
    course_id = cursor.lastrowid
    conn.close()
    return course_id

def get_all_courses() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, t.name as teacher_name 
        FROM courses c 
        JOIN teachers t ON c.teacher_id = t.id 
        ORDER BY c.created_at DESC
    """)
    courses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return courses

def create_lecture(course_id: int, title: str, video_url: str, duration_seconds: int = 600) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO lectures (course_id, title, video_url, duration_seconds) VALUES (?, ?, ?, ?)",
        (course_id, title, video_url, duration_seconds)
    )
    conn.commit()
    lecture_id = cursor.lastrowid
    conn.close()
    return lecture_id

def get_lectures_by_course(course_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM lectures WHERE course_id = ? ORDER BY id ASC", (course_id,))
    lectures = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return lectures

def add_topic(lecture_id: int, title: str, start_time: int, end_time: int, description: str = "") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO topics (lecture_id, title, start_time, end_time, description) VALUES (?, ?, ?, ?, ?)",
        (lecture_id, title, start_time, end_time, description)
    )
    conn.commit()
    topic_id = cursor.lastrowid
    conn.close()
    return topic_id

def get_topics_by_lecture(lecture_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM topics WHERE lecture_id = ? ORDER BY start_time ASC", (lecture_id,))
    topics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return topics

def add_quiz_question(topic_id: int, question: str, opt_a: str, opt_b: str, opt_c: str, opt_d: str, correct: str, explanation: str = "") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO quizzes (topic_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (topic_id, question, opt_a, opt_b, opt_c, opt_d, correct.upper(), explanation)
    )
    conn.commit()
    quiz_id = cursor.lastrowid
    conn.close()
    return quiz_id

def get_quizzes_by_topic(topic_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quizzes WHERE topic_id = ?", (topic_id,))
    quizzes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return quizzes

def submit_quiz_answer(student_id: int, quiz_id: int, selected_option: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT correct_option FROM quizzes WHERE id = ?", (quiz_id,))
    quiz = cursor.fetchone()
    if not quiz:
        conn.close()
        return {"error": "Quiz not found"}

    is_correct = (selected_option.upper() == quiz["correct_option"])
    score = 100.0 if is_correct else 0.0

    cursor.execute(
        "INSERT INTO quiz_results (student_id, quiz_id, selected_option, is_correct, score) VALUES (?, ?, ?, ?, ?)",
        (student_id, quiz_id, selected_option.upper(), is_correct, score)
    )
    conn.commit()
    conn.close()

    return {"quiz_id": quiz_id, "is_correct": is_correct, "score": score}

def log_video_event(student_id: int, lecture_id: int, event_type: str, position_seconds: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO video_events (student_id, lecture_id, event_type, position_seconds) VALUES (?, ?, ?, ?)",
        (student_id, lecture_id, event_type, position_seconds)
    )
    conn.commit()
    conn.close()

def log_engagement_metric(student_id: int, lecture_id: int, timestamp_sec: float, focus_state: str, pitch: float, yaw: float, roll: float, ear: float, confidence: float = 1.0):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO engagement_logs 
           (student_id, lecture_id, timestamp_seconds, focus_state, pitch, yaw, roll, ear, confidence) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (student_id, lecture_id, timestamp_sec, focus_state, pitch, yaw, roll, ear, confidence)
    )
    conn.commit()
    conn.close()

def save_difficulty_score(student_id: int, lecture_id: int, topic_id: int, eng_score: float, quiz_score: float, replays: int, pauses: int, watch_ratio: float, diff_score: float, diff_label: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO difficulty_scores 
           (student_id, lecture_id, topic_id, engagement_score, quiz_score, replay_count, pause_count, watch_time_ratio, difficulty_score, difficulty_label) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (student_id, lecture_id, topic_id, eng_score, quiz_score, replays, pauses, watch_ratio, diff_score, diff_label)
    )
    conn.commit()
    conn.close()

def get_topic_difficulty_summary(lecture_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            t.id as topic_id,
            t.title as topic_title,
            t.start_time,
            t.end_time,
            AVG(ds.difficulty_score) as avg_difficulty,
            AVG(ds.engagement_score) as avg_engagement,
            AVG(ds.quiz_score) as avg_quiz_score,
            SUM(ds.replay_count) as total_replays,
            COUNT(DISTINCT ds.student_id) as student_count
        FROM topics t
        LEFT JOIN difficulty_scores ds ON t.id = ds.topic_id
        WHERE t.lecture_id = ?
        GROUP BY t.id
        ORDER BY t.start_time ASC
    """, (lecture_id,))
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results

def get_student_learning_report(student_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            ds.*,
            t.title as topic_title,
            l.title as lecture_title,
            c.title as course_title
        FROM difficulty_scores ds
        JOIN topics t ON ds.topic_id = t.id
        JOIN lectures l ON ds.lecture_id = l.id
        JOIN courses c ON l.course_id = c.id
        WHERE ds.student_id = ?
        ORDER BY ds.calculated_at DESC
    """, (student_id,))
    reports = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return reports
