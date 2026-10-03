def test_root_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["app"] == "LearnPulse AI"


# --- Authentication -------------------------------------------------------

def test_auth_login(client):
    response = client.post("/api/auth/login", json={
        "email": "alan.turing@university.edu",
        "password": "teacher123",
        "role": "teacher"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alan.turing@university.edu"
    assert data["user"]["role"] == "teacher"


def test_login_rejects_wrong_password_and_wrong_portal(client):
    assert client.post("/api/auth/login", json={
        "email": "alan.turing@university.edu", "password": "nope"
    }).status_code == 401
    assert client.post("/api/auth/login", json={
        "email": "alex.rivera@student.edu", "password": "student123", "role": "admin"
    }).status_code == 403


def test_protected_routes_require_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/analytics/student").status_code == 401
    assert client.get("/api/reports/download").status_code == 401
    assert client.post("/api/revision/generate", json={"topic_title": "x"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_register_flow_and_admin_self_registration_blocked(client):
    blocked = client.post("/api/auth/register", json={
        "name": "Mallory", "email": "mallory@example.com", "password": "password123", "role": "admin"
    })
    assert blocked.status_code == 403

    res = client.post("/api/auth/register", json={
        "name": "New Student", "email": "New.Student@example.com", "password": "password123", "role": "student"
    })
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["role"] == "student"
    assert user["email"] == "new.student@example.com"
    assert user["camera_consent"] is False

    duplicate = client.post("/api/auth/register", json={
        "name": "New Student", "email": "new.student@example.com", "password": "password123", "role": "student"
    })
    assert duplicate.status_code == 400

    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "new.student@example.com"


def test_passwords_are_salted_and_legacy_hashes_still_verify():
    from backend.app.core.security import hash_password, verify_password, needs_rehash, _legacy_hash

    first, second = hash_password("student123"), hash_password("student123")
    assert first != second
    assert verify_password("student123", first)
    assert not verify_password("wrong", first)
    assert not needs_rehash(first)

    legacy = _legacy_hash("student123")
    assert verify_password("student123", legacy)
    assert needs_rehash(legacy)


def test_role_guards(client, student_headers, teacher_headers, admin_headers):
    assert client.get("/api/admin/status", headers=student_headers).status_code == 403
    assert client.get("/api/admin/status", headers=teacher_headers).status_code == 403
    assert client.get("/api/admin/status", headers=admin_headers).status_code == 200
    assert client.get("/api/analytics/teacher", headers=student_headers).status_code == 403
    assert client.get("/api/users", headers=teacher_headers).status_code == 403
    assert client.post("/api/courses", headers=student_headers, json={
        "title": "x", "course_code": "X1"
    }).status_code == 403


# --- Course content -------------------------------------------------------

def test_get_courses(client):
    response = client.get("/api/courses")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(len(c["lectures"]) > 0 for c in data)


def test_get_lectures(client):
    response = client.get("/api/lectures?course_id=1")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data[0]["topics"]) == 3


def test_teacher_content_crud_and_ownership(client, teacher_headers, teacher2_headers, student_headers):
    course = client.post("/api/courses", headers=teacher_headers, json={
        "title": "Test Course", "course_code": "TST101", "description": "temp"
    })
    assert course.status_code == 201
    course_id = course.json()["id"]

    # Another teacher cannot touch it
    assert client.delete(f"/api/courses/{course_id}", headers=teacher2_headers).status_code == 403
    assert client.post("/api/lectures", headers=teacher2_headers, json={
        "course_id": course_id, "title": "L", "video_url": "https://example.com/v.mp4"
    }).status_code == 403

    lecture = client.post("/api/lectures", headers=teacher_headers, json={
        "course_id": course_id, "title": "Lecture A", "video_url": "https://example.com/v.mp4", "duration_seconds": 300
    })
    assert lecture.status_code == 201
    lecture_id = lecture.json()["id"]

    assert client.post("/api/topics", headers=teacher_headers, json={
        "lecture_id": lecture_id, "title": "Bad range", "start_time": 100, "end_time": 50
    }).status_code == 400

    topic = client.post("/api/topics", headers=teacher_headers, json={
        "lecture_id": lecture_id, "title": "Topic A", "start_time": 0, "end_time": 150, "description": "Intro"
    })
    assert topic.status_code == 201
    topic_id = topic.json()["id"]

    quiz = client.post("/api/quizzes", headers=teacher_headers, json={
        "topic_id": topic_id, "question": "2 + 2?", "option_a": "3", "option_b": "4",
        "option_c": "5", "option_d": "6", "correct_option": "b", "explanation": "Arithmetic."
    })
    assert quiz.status_code == 201
    quiz_id = quiz.json()["id"]
    assert quiz.json()["correct_option"] == "B"

    # Students do not get the answer key; teachers do
    student_view = client.get(f"/api/quizzes?topic_id={topic_id}", headers=student_headers).json()
    assert student_view[0]["correct_option"] is None
    assert student_view[0]["explanation"] is None
    teacher_view = client.get(f"/api/quizzes?topic_id={topic_id}", headers=teacher_headers).json()
    assert teacher_view[0]["correct_option"] == "B"

    assert client.delete(f"/api/quizzes/{quiz_id}", headers=teacher2_headers).status_code == 403
    assert client.delete(f"/api/quizzes/{quiz_id}", headers=teacher_headers).status_code == 200
    assert client.delete(f"/api/courses/{course_id}", headers=teacher_headers).status_code == 200
    assert client.get(f"/api/lectures/{lecture_id}").status_code == 404


# --- Engagement, quizzes and the difficulty pipeline ----------------------

def test_engagement_predict(client, student_headers):
    res = client.post("/api/engagement/predict", json={
        "pitch": 0.0, "yaw": 0.0, "roll": 0.0, "ear": 0.30, "gaze_offset": 0.0, "face_detected": True
    }, headers=student_headers)
    assert res.status_code == 200
    assert res.json()["focus_state"] == "Focused"


def test_engagement_events_persistence(client, student_headers):
    res = client.post("/api/engagement/events", json={
        "lecture_id": 1,
        "topic_id": 1,
        "timestamp_seconds": 30.0,
        "state": "Focused",
        "confidence": 0.95,
        "metrics": {"pitch": 1.0, "yaw": -2.0, "roll": 0.0, "ear": 0.31, "gaze_offset": 0.05, "face_detected": True}
    }, headers=student_headers)
    assert res.status_code == 201
    assert res.json()["status"] == "success"


def test_engagement_event_validation(client, student_headers):
    base = {"lecture_id": 1, "timestamp_seconds": 10.0, "state": "Focused", "confidence": 0.9}
    assert client.post("/api/engagement/events", headers=student_headers, json={**base, "lecture_id": 9999}).status_code == 404
    # Topic 1 belongs to lecture 1, not lecture 2
    assert client.post("/api/engagement/events", headers=student_headers, json={**base, "lecture_id": 2, "topic_id": 1}).status_code == 404
    assert client.post("/api/engagement/events", headers=student_headers, json={**base, "state": "Happy"}).status_code == 422
    assert client.post("/api/engagement/events/video", headers=student_headers, json={
        "lecture_id": 1, "event_type": "EXPLODE", "position_seconds": 5
    }).status_code == 422


def test_engagement_requires_camera_consent(client):
    res = client.post("/api/auth/register", json={
        "name": "No Consent", "email": "noconsent@example.com", "password": "password123", "role": "student"
    })
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    payload = {"lecture_id": 1, "timestamp_seconds": 10.0, "state": "Focused", "confidence": 0.9}

    assert client.post("/api/engagement/events", headers=headers, json=payload).status_code == 403
    assert client.put("/api/auth/me", headers=headers, json={"camera_consent": True}).json()["camera_consent"] is True
    assert client.post("/api/engagement/events", headers=headers, json=payload).status_code == 201


def test_difficulty_calculation_is_stateless(client, student_headers):
    before = client.get("/api/difficulty/topics", headers=student_headers).json()
    response = client.post("/api/difficulty/calculate", headers=student_headers, json={
        "engagement_score": 50.0,
        "quiz_score": 40.0,
        "replay_count": 4,
        "pause_count": 3,
        "watch_time_ratio": 1.4
    })
    assert response.status_code == 200
    data = response.json()
    assert data["difficulty_label"] == "Difficult"
    assert 55 < data["difficulty_score"] <= 75
    assert client.get("/api/difficulty/topics", headers=student_headers).json() == before


def test_difficulty_engine_bounds_and_missing_signals():
    from ml.difficulty_engine import DifficultyEngine

    assert DifficultyEngine.calculate_difficulty(100, 100, 0, 0, 1.0) == (0.0, "Easy")
    worst, label = DifficultyEngine.calculate_difficulty(0, 0, 10, 10, 2.0)
    assert worst > 90 and label == "Very Difficult"

    # A missing signal is left out rather than scored as zero
    quiz_only, _ = DifficultyEngine.calculate_difficulty(None, 100, 0, 0, None)
    assert quiz_only == 0.0
    with_zero_engagement, _ = DifficultyEngine.calculate_difficulty(0, 100, 0, 0, None)
    assert with_zero_engagement > quiz_only


def test_full_learning_pipeline(client, student2_headers, teacher_headers):
    """Quiz answers, video events and camera engagement all flow into analytics for a fresh student."""
    headers = student2_headers

    empty = client.get("/api/analytics/student", headers=headers).json()
    assert empty["quiz_average"] is None
    assert empty["engagement_score"] is None
    assert empty["overall_learning_score"] is None
    assert empty["difficult_topics"] == []
    assert empty["engagement_timeline"]["points"] == []

    # Topic 2 (Backpropagation, 181s-420s of lecture 1): wrong answer + replays + pauses + distraction
    quiz = client.get("/api/quizzes?topic_id=2", headers=headers).json()[0]
    wrong = client.post("/api/quizzes/submit", headers=headers, json={"quiz_id": quiz["id"], "selected_option": "A"})
    assert wrong.status_code == 200
    assert wrong.json()["is_correct"] is False
    assert wrong.json()["correct_option"] == "B"
    assert wrong.json()["topic_quiz_score"] == 0.0
    assert wrong.json()["difficulty_label"] is not None

    for event_type, position in [("PLAY", 181), ("REPLAY", 200), ("REPLAY", 250), ("REPLAY", 300), ("PAUSE", 260), ("PAUSE", 310)]:
        res = client.post("/api/engagement/events/video", headers=headers, json={
            "lecture_id": 1, "event_type": event_type, "position_seconds": position
        })
        assert res.status_code == 200

    for i, state in enumerate(["Distracted", "Distracted", "Away", "Focused", "Low Engagement", "Distracted"]):
        res = client.post("/api/engagement/events", headers=headers, json={
            # No topic_id: the server resolves the topic from the timeline position
            "lecture_id": 1, "timestamp_seconds": 190 + i * 5, "state": state, "confidence": 0.9,
            "metrics": {"pitch": 5.0, "yaw": 30.0, "roll": 0.0, "ear": 0.28, "gaze_offset": 0.6, "face_detected": state != "Away"}
        })
        assert res.status_code == 201
        assert res.json()["topic_id"] == 2

    data = client.get("/api/analytics/student", headers=headers).json()
    assert data["quiz_average"] == 0.0
    assert data["engagement_score"] == round(100 / 6, 1)
    assert data["study_streak_days"] == 1
    assert len(data["engagement_timeline"]["points"]) >= 1
    assert data["engagement_timeline"]["lecture_id"] == 1

    assert len(data["difficult_topics"]) == 1
    topic = data["difficult_topics"][0]
    assert topic["topic_id"] == 2
    assert topic["replay_count"] == 3
    assert topic["pause_count"] == 2
    assert topic["quiz_score"] == 0.0
    assert topic["difficulty_label"] == "Very Difficult"
    assert data["focus_topic"]["topic_id"] == 2
    assert "Backpropagation" in data["recommendation"]

    # Becoming difficult raised exactly one revision notification
    notifications = client.get("/api/notifications", headers=headers).json()
    revision_notes = [n for n in notifications if n["title"] == "AI Revision Recommendation"]
    assert len(revision_notes) == 1
    assert client.post(f"/api/notifications/{revision_notes[0]['id']}/read", headers=headers).status_code == 200
    assert client.post("/api/notifications/read-all", headers=headers).status_code == 200
    assert all(n["read"] for n in client.get("/api/notifications", headers=headers).json())

    # Answering correctly afterwards lowers the difficulty (latest answer per question counts)
    right = client.post("/api/quizzes/submit", headers=headers, json={"quiz_id": quiz["id"], "selected_option": "B"})
    assert right.json()["is_correct"] is True
    assert right.json()["topic_quiz_score"] == 100.0
    assert right.json()["difficulty_score"] < topic["difficulty_score"]
    after = client.get("/api/analytics/student", headers=headers).json()
    assert len(after["difficult_topics"]) == 1
    assert after["quiz_average"] == 100.0

    # The teacher who owns the lecture sees the same activity
    teacher = client.get("/api/analytics/teacher?lecture_id=1", headers=teacher_headers).json()
    assert teacher["lecture"]["id"] == 1
    backprop = next(t for t in teacher["topic_summaries"] if t["topic_id"] == 2)
    assert backprop["student_count"] >= 1
    assert backprop["total_replays"] >= 3
    assert backprop["avg_difficulty"] is not None
    assert teacher["state_breakdown"]["Distracted"] >= 3
    assert teacher["engagement_alert"] is not None
    assert teacher["engagement_alert"]["topic"] == "Backpropagation & Chain Rule"

    # Teachers can view a student's analytics; students cannot view each other's
    as_teacher = client.get("/api/analytics/student?student_id=4", headers=teacher_headers)
    assert as_teacher.status_code == 200
    assert as_teacher.json()["student_name"] == "Sophia Chen"
    assert client.get("/api/analytics/student?student_id=3", headers=headers).status_code == 403

    roster = client.get("/api/analytics/students", headers=teacher_headers).json()
    assert any(s["student_id"] == 4 for s in roster)


def test_teacher_analytics_scoped_to_own_courses(client, teacher2_headers):
    # Lecture 1 belongs to the other teacher
    assert client.get("/api/analytics/teacher?lecture_id=1", headers=teacher2_headers).status_code == 404
    data = client.get("/api/analytics/teacher", headers=teacher2_headers).json()
    assert data["lecture"] is None
    assert data["topic_summaries"] == []
    assert data["average_engagement"] is None


# --- Revision, reports, admin ---------------------------------------------

def test_ai_revision_generation(client, student_headers):
    response = client.post("/api/revision/generate", headers=student_headers, json={
        "topic_title": "Backpropagation & Chain Rule",
        "course_title": "Deep Learning"
    })
    assert response.status_code == 200
    kit = response.json()["revision_kit"]
    assert kit["topic_title"] == "Backpropagation & Chain Rule"
    assert kit["source"] == "local"


def test_revision_kit_from_topic_uses_only_answered_quizzes(client, student2_headers, admin_headers):
    # Student 2 answered the topic-2 quiz in the pipeline test, but nothing in topic 3
    answered = client.post("/api/revision/generate", headers=student2_headers, json={"topic_id": 2}).json()["revision_kit"]
    assert answered["topic_id"] == 2
    assert answered["course_title"] == "Deep Learning & Neural Networks"
    assert len(answered["practice_questions"]) == 1
    assert answered["practice_questions"][0]["correct"] == "B"

    unanswered = client.post("/api/revision/generate", headers=student2_headers, json={"topic_id": 3}).json()["revision_kit"]
    assert unanswered["practice_questions"] == []
    assert unanswered["flashcards"] == []

    assert client.post("/api/revision/generate", headers=student2_headers, json={"topic_id": 9999}).status_code == 404
    assert client.post("/api/revision/generate", headers=student2_headers, json={}).status_code == 422


def test_revision_llm_response_parsing():
    from ai.revision_generator import AIRevisionGenerator

    gen = AIRevisionGenerator()
    good = gen._parse_llm_response('''```json
    {"summary": "S", "key_takeaways": ["a", "b"],
     "flashcards": [{"question": "q", "answer": "a"}, {"question": "no answer"}],
     "practice_questions": [
        {"question": "p", "options": ["A) 1", "B) 2", "C) 3", "D) 4"], "correct": "c", "explanation": "e"},
        {"question": "too few options", "options": ["A) 1"], "correct": "A"}
     ]}
    ```''')
    assert good["summary"] == "S"
    assert len(good["flashcards"]) == 1
    assert len(good["practice_questions"]) == 1
    assert good["practice_questions"][0]["correct"] == "C"

    assert gen._parse_llm_response("Sorry, I cannot help with that.") is None
    assert gen._parse_llm_response('{"summary": ""}') is None


def test_report_download(client, student_headers, teacher_headers):
    res = client.get("/api/reports/download", headers=student_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content[:4] == b"%PDF"

    assert client.get("/api/reports/download", headers=teacher_headers).status_code == 400
    assert client.get("/api/reports/download?student_id=3", headers=teacher_headers).status_code == 200
    assert client.get("/api/reports/download?student_id=4", headers=student_headers).status_code == 403


def test_admin_status_and_user_management(client, admin_headers):
    status = client.get("/api/admin/status", headers=admin_headers).json()
    assert status["database"]["student_count"] >= 2
    assert status["ai_provider"]["active_provider"] == "local"
    assert any(a["action"] == "USER_LOGIN" for a in status["audit_logs"])

    users = client.get("/api/users", headers=admin_headers).json()
    assert len(users) >= 5
    admin_id = next(u["id"] for u in users if u["role"] == "admin")
    assert client.delete(f"/api/users/{admin_id}", headers=admin_headers).status_code == 400

    created = client.post("/api/auth/register", json={
        "name": "Temp User", "email": "temp.user@example.com", "password": "password123", "role": "student"
    }).json()["user"]
    promoted = client.put(f"/api/users/{created['id']}/role", headers=admin_headers, json={"role": "teacher"})
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "teacher"
    assert client.put(f"/api/users/{created['id']}/role", headers=admin_headers, json={"role": "wizard"}).status_code == 400
    assert client.delete(f"/api/users/{created['id']}", headers=admin_headers).status_code == 200
    assert client.get(f"/api/users/{created['id']}", headers=admin_headers).status_code == 404

    # A teacher who owns courses cannot be deleted out from under them
    assert client.delete("/api/users/1", headers=admin_headers).status_code == 409


def test_capture_never_silently_simulates():
    import pytest
    from computer_vision.capture import WebcamCapture

    sim = WebcamCapture.generate_simulated_metrics("Focused")
    assert sim["simulated"] is True

    capture = WebcamCapture.__new__(WebcamCapture)
    capture.camera_index = 0
    capture.cap = None
    capture.is_running = False
    with pytest.raises(RuntimeError):
        capture.process_live_frame()
    assert capture.process_live_frame(allow_simulation=True)["simulated"] is True
