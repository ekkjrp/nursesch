"""인증 라우터 — 로그인 / 현재 사용자 조회"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import verify_password, create_access_token, get_current_nurse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenOut)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    nurse = db.query(models.Nurse).filter(models.Nurse.email == req.email).first()
    if not nurse or not verify_password(req.password, nurse.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    token = create_access_token({"sub": str(nurse.id), "grade": nurse.grade})
    return {"access_token": token, "token_type": "bearer", "nurse": nurse}


@router.get("/me", response_model=schemas.NurseOut)
def me(current: models.Nurse = Depends(get_current_nurse)):
    return current
