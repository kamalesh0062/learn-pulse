"""
LearnPulse AI - Unified Production Server Launcher
Serves both the React Frontend SPA and FastAPI REST Backend APIs on http://localhost:8000
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn

if __name__ == "__main__":
    print("=" * 70)
    print("[LEARNPULSE AI] PRODUCTION WEB APPLICATION SERVER")
    print("=" * 70)
    print("  * Web App URL:      http://localhost:8000")
    print("  * Alternative URL:  http://127.0.0.1:8000")
    print("  * Swagger API Docs: http://localhost:8000/docs")
    print("=" * 70)
    
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
