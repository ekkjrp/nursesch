"""FastAPI 앱 진입점 (v1.2)"""
import os
import time
import logging
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routes import auth, wards, nurses, rules, schedules, shift_requests, holidays, leaves, logs

# ── 로깅 설정 ──
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("nursesch")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "api.log"),
    maxBytes=2 * 1024 * 1024,  # 2MB
    backupCount=10,
    encoding="utf-8",
)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))
logger.addHandler(file_handler)

# frontend logger도 같은 핸들러 사용
logging.getLogger("nursesch.frontend").addHandler(file_handler)
logging.getLogger("nursesch.frontend").setLevel(logging.INFO)

# DB 테이블 자동 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="NurseSch API", version="1.2.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = (time.time() - start) * 1000
    logger.info(f"{request.method} {request.url.path} {response.status_code} {elapsed:.0f}ms")
    return response


app.include_router(auth.router)
app.include_router(wards.router)
app.include_router(nurses.router)
app.include_router(rules.router)
app.include_router(schedules.router)
app.include_router(shift_requests.router)
app.include_router(holidays.router)
app.include_router(leaves.router)
app.include_router(logs.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.2.0"}
