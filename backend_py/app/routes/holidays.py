"""공휴일 라우터"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import holidays as holidays_lib
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
    body: schemas.HolidayCreate,
    ward_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    h = models.Holiday(ward_id=ward_id, date=body.date, name=body.name, type=body.type)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.post("/auto-fill", response_model=List[schemas.HolidayOut])
def auto_fill_holidays(
    ward_id: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """한국 공휴일을 자동으로 일괄 등록 (중복 제외)"""
    kr_holidays = holidays_lib.KR(years=year)

    # 이미 등록된 날짜 조회
    existing_dates = set(
        row.date for row in
        db.query(models.Holiday.date)
        .filter(models.Holiday.ward_id == ward_id)
        .all()
    )

    created = []
    for date, name in sorted(kr_holidays.items()):
        date_str = date.strftime("%Y-%m-%d")
        if date_str in existing_dates:
            continue
        h = models.Holiday(ward_id=ward_id, date=date_str, name=name, type="HOLIDAY")
        db.add(h)
        created.append(h)

    db.commit()
    for h in created:
        db.refresh(h)
    return created


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    h = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="공휴일을 찾을 수 없습니다.")
    db.delete(h)
    db.commit()
    return {"message": "삭제되었습니다."}
