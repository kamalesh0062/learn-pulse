# ⚡ LearnPulse AI — Educational Analytics Platform

LearnPulse AI is a production-grade full-stack SaaS platform for educational analytics, privacy-first computer vision engagement tracking, Random Forest topic difficulty estimation, and automated generative AI revision kits.

---

## 🏗️ Production Architecture

```text
                    LEARNPULSE AI
                         |
             ┌───────────┴───────────┐
             │                       │
        React Frontend          FastAPI Backend
       (Vite, TS, Tailwind)    (Python, SQLAlchemy, JWT)
             │                       │
             │ REST API              │
             └───────────►───────────┘
                                     |
                   ┌─────────────────┼─────────────────┐
                   │                 │                 │
                Database             ML                AI
                   │                 │                 │
                SQLite/PostgreSQL   CV             Gemini/OpenAI
```

### Stack Components:
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, TanStack Query, Axios, React Router.
* **Backend**: FastAPI, SQLAlchemy, Pydantic, python-jose (JWT), PBKDF2 password hashing, Uvicorn.
* **Computer Vision**: MediaPipe FaceLandmarker running in the browser (WebAssembly) for head pose and Eye Aspect Ratio; OpenCV + MediaPipe on the server are optional (`/api/engagement/analyze_frame`).
* **Machine Learning**: Scikit-Learn Random Forest Classifier + Fallback Engine.
* **Generative AI**: Google Gemini or OpenAI for revision kits when an API key is set; otherwise an offline kit assembled from the lecturer's topic notes and quiz questions (clearly labelled as such in the UI).

---

## 🚀 Quick Start Guide

### 1. Single-server mode (recommended)
FastAPI serves both the REST API and the built React app on one port.
```bash
pip install -r requirements.txt

cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

python server.py
```
Web app: http://localhost:8000 — Swagger UI: http://localhost:8000/docs

### 2. Development mode (hot reload)
```bash
# Terminal 1: API on http://localhost:8000
python -m uvicorn backend.app.main:app --port 8000 --reload

# Terminal 2: Vite dev server on http://localhost:5173 (proxies /api to :8000)
cd frontend
npm run dev
```

### Demo accounts
A fresh database is seeded with these accounts (see `backend/app/database/init_db.py`).
Change or delete them before exposing the app to anyone else.

| Role    | Email                        | Password     |
| :------ | :--------------------------- | :----------- |
| Student | alex.rivera@student.edu      | `student123` |
| Student | sophia.chen@student.edu      | `student123` |
| Teacher | alan.turing@university.edu   | `teacher123` |
| Teacher | ada.lovelace@university.edu  | `teacher123` |
| Admin   | admin@learnpulse.ai          | `admin123`   |

Alex Rivera comes with demo activity so the dashboards have something to show; Sophia Chen starts empty.

### Configuration
Environment variables (see `.env.example`):
* `JWT_SECRET` — **set this in any real deployment**; the built-in default is public in this repository.
* `DATABASE_URL` — defaults to `sqlite:///database/learnpulse.db`.
* `GEMINI_API_KEY` / `OPENAI_API_KEY` — enable AI-written revision kits (`GEMINI_MODEL` / `OPENAI_MODEL` override the model).
* `CORS_ORIGINS` — comma-separated origins allowed to call the API.

### Tests
```bash
python -m pytest tests -q
```
The suite runs against a temporary database and never touches `database/learnpulse.db`.

### 3. Docker Deployment
```bash
docker compose up --build
```
* React Frontend → http://localhost:5173 (nginx, proxies `/api` to the backend container)
* FastAPI Backend → http://localhost:8000
* OpenAPI Swagger → http://localhost:8000/docs

---

## 🔒 Privacy Guarantee
* **Opt-in**: Camera analytics is off for newly registered accounts. Without consent the API rejects engagement data for that account.
* **Zero Video Storage**: Webcam frames stay in browser memory for landmark extraction and are discarded immediately. Only averaged numbers (head pose, EAR, gaze offset, focus state) are sent every 5 seconds.
* **No Emotion Recognition**: Focus is derived from head orientation and eye openness only.

---

## ⚡ Main Portals
Each account sees only its own portal; the role comes from the signed-in account.
* **Student** — `/student` dashboard, `/courses`, `/player/:lectureId`, `/quiz`, `/revision`, `/analytics`, `/reports`.
* **Teacher** — `/teacher` dashboard, `/courses`, `/lectures` (lectures & topics), `/quiz-management` (quiz builder), `/analytics` (student roster), `/reports`.
* **Admin** — everything a teacher has across all courses, plus `/admin` (system status, audit log) and `/users` (roles, account deletion).

## 🔁 How the data flows
```text
Video player ── PLAY / PAUSE / SEEK / REPLAY ──┐
Webcam (browser MediaPipe) ── 5 s aggregates ──┼─► backend/app/services/learning.py
Topic quiz ── answers ─────────────────────────┘        │
                                                        ▼
                               per-student, per-topic difficulty score
                                (ml/difficulty_engine.py, 0 = easy, 100 = hard)
                                                        │
          ┌───────────────┬───────────────┬─────────────┴──┬──────────────┐
          ▼               ▼               ▼                ▼              ▼
   Student dashboard  Teacher heatmap  Notifications  Revision kits  PDF reports
```
A signal that has not been observed (no quiz attempt, camera off) is left out of the score
and shown as "—" rather than being filled in with a default.
