"""FastAPI 앱 진입점"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routes import auth, wards, nurses, rules, schedules, shift_requests, holidays, leaves

# DB 테이블 자동 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="NurseSch API", version="1.1.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(wards.router)
app.include_router(nurses.router)
app.include_router(rules.router)
app.include_router(schedules.router)
app.include_router(shift_requests.router)
app.include_router(holidays.router)
app.include_router(leaves.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.1.0"}
