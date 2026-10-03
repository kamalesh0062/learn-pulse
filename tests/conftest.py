"""
Test configuration: every test run uses a throwaway SQLite database so the
real database/learnpulse.db is never read or written by the test suite.
"""

import os
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

_TEST_DB_DIR = tempfile.mkdtemp(prefix="learnpulse_test_")
# Must be set before backend.app.core.config is imported anywhere
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TEST_DB_DIR, 'test.db').as_posix()}"
os.environ["GEMINI_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    from backend.app.main import app
    from backend.app.database.init_db import init_and_seed_db

    init_and_seed_db()
    with TestClient(app) as test_client:
        yield test_client


def _login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="session")
def student_headers(client):
    return _login(client, "alex.rivera@student.edu", "student123")


@pytest.fixture(scope="session")
def student2_headers(client):
    return _login(client, "sophia.chen@student.edu", "student123")


@pytest.fixture(scope="session")
def teacher_headers(client):
    return _login(client, "alan.turing@university.edu", "teacher123")


@pytest.fixture(scope="session")
def teacher2_headers(client):
    return _login(client, "ada.lovelace@university.edu", "teacher123")


@pytest.fixture(scope="session")
def admin_headers(client):
    return _login(client, "admin@learnpulse.ai", "admin123")
