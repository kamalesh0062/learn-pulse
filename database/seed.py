"""
LearnPulse AI - Database Seed Script
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
from database.schema import init_db
from database.db_helper import (
    register_user, create_course, create_lecture, add_topic,
    add_quiz_question, log_engagement_metric, log_video_event,
    save_difficulty_score
)

def seed_database():
    init_db()
    print("[INFO] Seeding LearnPulse AI database...")

    t1 = register_user("Dr. Alan Turing", "alan.turing@university.edu", "password123", role="teacher", extra_info="Computer Science")
    teacher_id = t1["id"] if t1 else 1

    students = []
    student_names = [
        ("Sophia Chen", "sophia@student.edu", "ENR202601"),
        ("Marcus Vance", "marcus@student.edu", "ENR202602"),
        ("Elena Rostova", "elena@student.edu", "ENR202603"),
        ("Liam O'Connor", "liam@student.edu", "ENR202604"),
        ("Aarav Sharma", "aarav@student.edu", "ENR202605")
    ]
    for name, email, enr in student_names:
        u = register_user(name, email, "password123", role="student", extra_info=enr)
        if u:
            students.append(u)

    c1 = create_course(teacher_id, "CS50: Deep Learning & Neural Networks", "CS50-DL", "Master Convolutional Networks, Transformers, and Optimization.")
    l1 = create_lecture(c1, "Lecture 4: Backpropagation & Gradient Descent", "https://www.w3schools.com/html/mov_bbb.mp4", duration_seconds=600)
    
    top1 = add_topic(l1, "1. Computational Graphs & Chain Rule", 0, 180, "Deriving partial derivatives across multi-layer graphs.")
    top2 = add_topic(l1, "2. Vanishing & Exploding Gradients", 181, 360, "Understanding saturation in Sigmoid vs ReLU activations.")
    top3 = add_topic(l1, "3. Adam & RMSprop Optimizers", 361, 600, "Adaptive learning rates and momentum acceleration.")

    q1 = add_quiz_question(
        top1, 
        "What calculus rule forms the foundation of Backpropagation?", 
        "Product Rule", "Chain Rule", "Quotient Rule", "L'Hopital's Rule", 
        "B", "The Chain Rule calculates derivatives of composite functions step-by-step."
    )

    q2 = add_quiz_question(
        top2, 
        "Which activation function helps mitigate the vanishing gradient problem?", 
        "Sigmoid", "Tanh", "ReLU", "Softmax", 
        "C", "ReLU (Rectified Linear Unit) maintains non-saturating gradients for positive inputs."
    )

    q3 = add_quiz_question(
        top3, 
        "What primary mechanism does Adam optimizer combine?", 
        "SGD and L1 Regularization", 
        "Momentum and RMSprop", 
        "Batch Norm and Dropout", 
        "Leaky ReLU and Gradient Clipping", 
        "B", "Adam combines first moment (Momentum) and second moment (RMSprop) estimates."
    )

    focus_states = ["Focused", "Focused", "Focused", "Distracted", "Low Engagement"]
    
    for s in students:
        sid = s["id"]
        for sec in range(0, 600, 30):
            state = random.choice(focus_states)
            pitch = random.uniform(-10, 10) if state == "Focused" else random.uniform(15, 35)
            yaw = random.uniform(-10, 10) if state == "Focused" else random.uniform(-30, 30)
            ear = random.uniform(0.25, 0.35) if state != "Low Engagement" else random.uniform(0.12, 0.18)
            log_engagement_metric(sid, l1, float(sec), state, pitch, yaw, 0.0, ear)

        if random.random() > 0.3:
            log_video_event(sid, l1, "replay", 240)
            log_video_event(sid, l1, "pause", 250)

        topic_data = [
            (top1, 85.0, 90.0, 0, 0, 1.0, 18.5, "Easy"),
            (top2, 60.0, 50.0, 3, 2, 1.2, 68.0, "Difficult"),
            (top3, 72.0, 75.0, 1, 1, 1.0, 42.0, "Moderate")
        ]

        for tid, eng, quiz, rep, pau, wat, diff, label in topic_data:
            v_eng = max(0, min(100, eng + random.uniform(-10, 10)))
            v_quiz = max(0, min(100, quiz + random.choice([-25, 0, 25])))
            v_diff = max(0, min(100, diff + random.uniform(-8, 8)))
            
            save_difficulty_score(
                student_id=sid,
                lecture_id=l1,
                topic_id=tid,
                eng_score=v_eng,
                quiz_score=v_quiz,
                replays=rep,
                pauses=pau,
                watch_ratio=wat,
                diff_score=v_diff,
                diff_label=label
            )

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
