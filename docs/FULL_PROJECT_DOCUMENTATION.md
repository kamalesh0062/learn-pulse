# ⚡ LearnPulse AI — Full Project Technical Documentation

LearnPulse AI is a commercial-grade educational analytics and personalized learning platform engineered with a **React + TypeScript + Vite** frontend and a **FastAPI** backend.

---

## 1. System Architecture Overview

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

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query, Axios.
* **Backend**: FastAPI, SQLAlchemy ORM, Pydantic V2, PyJWT, Passlib (Bcrypt).
* **Computer Vision**: OpenCV, MediaPipe FaceMesh (468 3D landmarks, EAR, Head Pose).
* **Machine Learning**: Scikit-Learn Random Forest Classifier + Fallback Engine.
* **Generative AI**: Google Gemini API & OpenAI API with local offline fallback.

---

## 2. Directory Structure

```text
d:/learnpulse/
├── backend/
│   └── app/
│       ├── main.py                  # Main FastAPI Application & CORS configuration
│       ├── core/                    # Security, JWT, and Configuration settings
│       ├── database/                # SQLAlchemy ORM Session, Models, & Seeds
│       ├── schemas/                 # Pydantic Request & Response Validation Schemas
│       └── api/                     # REST API Routers (Auth, Courses, Quizzes, Analytics, CV)
│
├── frontend/
│   ├── src/
│   │   ├── components/              # Video Player, Navbar, Sidebar, Recharts
│   │   ├── pages/                   # Dashboards, Courses, Quiz, AI Revision
│   │   ├── services/                # Axios API Services (authApi, courseApi, etc.)
│   │   ├── contexts/                # AuthContext & Role Management
│   │   ├── types/                   # TypeScript Type Interfaces
│   │   └── App.tsx                  # React Router Configuration
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.ts               # Vite configuration & Proxy
│
├── computer_vision/                 # MediaPipe FaceMesh & EAR Extractor
├── ml/                              # Random Forest Model & Difficulty Engine
├── ai/                              # Gemini / OpenAI Revision Generator
├── database/                        # SQLite storage (`learnpulse.db`)
├── requirements.txt                 # Backend Python dependencies
├── server.py                        # Convenience backend launcher
└── README.md                        # Project Overview & Setup Guide
```

---

## 3. Setup & Execution Guide

### Step 1: Launch FastAPI Backend Server
```bash
python server.py
```
* **Backend API Base**: `http://localhost:8000`
* **Interactive Swagger Docs**: `http://localhost:8000/docs`
* **ReDoc Documentation**: `http://localhost:8000/redoc`

### Step 2: Launch React Frontend Web Application
Open a second terminal window:
```bash
cd frontend
npm run dev
```
* **React Web Application**: `http://localhost:5173`

---

## 4. Privacy Guarantee
* **Zero Video Storage**: Raw video frames exist exclusively in browser RAM during MediaPipe landmark extraction and are discarded immediately.
* **In-Memory CV**: Landmark processing computes 468 3D facial points and pitch/yaw/roll orientation without saving video files.
* **No Emotion Recognition**: Focus calculation is purely mathematical based on screen orientation angles and EAR.
