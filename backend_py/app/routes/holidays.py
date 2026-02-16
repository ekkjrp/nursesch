"""공휴일 라우터"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


@router.get("", response_model=List[schemas.HolidayOut])
def list_holidays(
    ward_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_nurse),
):
    return db.query(models.Holiday).filter(models.Holiday.ward_id == ward_id).all()


@router.post("", response_model=schemas.HolidayOut)
def create_holiday(
    ward_id: int = Query(...),
    body: schemas.HolidayCreate = ...,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    h = models.Holiday(ward_id=ward_id, date=body.date, name=body.name, type=body.type)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    h = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="공휴일을 찾을 수 없습니다.")
    db.delete(h)
    db.commit()
    return {"message": "삭제되었습니다."}
