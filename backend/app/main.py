import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.app.core.config import settings
from backend.app.database.init_db import init_and_seed_db
from backend.app.api import (
    auth, users, courses, lectures, topics, quizzes,
    engagement, analytics, difficulty, revision, reports,
    notifications, admin
)

DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    print("[INFO] Starting LearnPulse AI FastAPI Engine...")
    try:
        init_and_seed_db()
    except Exception as e:
        print(f"[WARNING] Database init notice: {e}")
    try:
        from ml.predict import EngagementPredictor
        app.state.predictor = EngagementPredictor()
        print("[INFO] Random Forest Engagement Predictor preloaded successfully.")
    except Exception as e:
        print(f"[WARNING] EngagementPredictor preload notice: {e}")
    yield
    # Shutdown tasks
    print("[INFO] Shutting down LearnPulse AI FastAPI Engine.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Auth uses a Bearer token header, not cookies
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
api_v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1)
app.include_router(users.router, prefix=api_v1)
app.include_router(courses.router, prefix=api_v1)
app.include_router(lectures.router, prefix=api_v1)
app.include_router(topics.router, prefix=api_v1)
app.include_router(quizzes.router, prefix=api_v1)
app.include_router(engagement.router, prefix=api_v1)
app.include_router(analytics.router, prefix=api_v1)
app.include_router(difficulty.router, prefix=api_v1)
app.include_router(revision.router, prefix=api_v1)
app.include_router(reports.router, prefix=api_v1)
app.include_router(notifications.router, prefix=api_v1)
app.include_router(admin.router, prefix=api_v1)

# Mount Static Assets if Frontend Dist Exists
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

STATIC_DIR = PROJECT_ROOT / "static"

@app.get("/vision_test.html")
@app.get("/vision-standalone")
async def serve_vision_standalone():
    vision_file = STATIC_DIR / "vision_test.html"
    if vision_file.exists():
        return FileResponse(str(vision_file))
    return JSONResponse(status_code=404, content={"detail": "Standalone Vision file not found"})

@app.get("/api/health")
def api_health():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "documentation": "/docs",
        "health": f"{settings.API_V1_STR}/admin/status"
    }

# SPA Fallback Route: Serves React SPA index.html for all non-API paths
@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    # If request is to API or docs, let FastAPI handles it (404 if missing)
    if full_path.startswith("api/") or full_path in ["docs", "redoc", "openapi.json"]:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "documentation": "/docs",
        "message": "Frontend build dist/index.html not found. Run 'cd frontend && npm run build' to generate static assets."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
