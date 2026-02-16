"""연차/희망 휴일 관리 라우터"""
import json
import calendar
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin
from app.engine.validator import _is_weekend

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


def _calc_total_off(nurse_id: int, year_month: str, db: Session, holidays: List[str]) -> int:
    """총 목표 비근무일수 = 주말 + 공휴일(비주말) + 연차"""
    year, month = map(int, year_month.split("-"))
    n = calendar.monthrange(year, month)[1]
    all_dates = [f"{year_month}-{d:02d}" for d in range(1, n + 1)]

    weekend_cnt = sum(1 for d in all_dates if _is_weekend(d))
    holiday_cnt = sum(1 for d in holidays if d.startswith(year_month) and not _is_weekend(d))

    leave = db.query(models.NurseMonthlyLeave).filter(
        models.NurseMonthlyLeave.nurse_id == nurse_id,
        models.NurseMonthlyLeave.year_month == year_month,
    ).first()
    annual = leave.annual_leave_count if leave else 1
    return weekend_cnt + holiday_cnt + annual


@router.get("/{nurse_id}/{year_month}", response_model=schemas.LeaveOut)
def get_leave(
    nurse_id: int,
    year_month: str,
    ward_id: int = Query(None),
    db: Session = Depends(get_db),
    current=Depends(get_current_nurse),
):
    # 본인이거나 HN만 조회 가능
    if current.id != nurse_id and current.grade != "HN":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    leave = db.query(models.NurseMonthlyLeave).filter(
        models.NurseMonthlyLeave.nurse_id == nurse_id,
        models.NurseMonthlyLeave.year_month == year_month,
    ).first()

    # 공휴일 목록
    holidays = []
    if ward_id:
        hols = db.query(models.Holiday).filter(
            models.Holiday.ward_id == ward_id
        ).all()
        holidays = [h.date for h in hols]

    annual = leave.annual_leave_count if leave else 1
    off_dates = json.loads(leave.requested_off_dates) if leave else []
    total = _calc_total_off(nurse_id, year_month, db, holidays)

    return schemas.LeaveOut(
        id=leave.id if leave else 0,
        nurse_id=nurse_id,
        year_month=year_month,
        annual_leave_count=annual,
        requested_off_dates=off_dates,
        total_off_days=total,
    )


@router.put("/{nurse_id}/{year_month}", response_model=schemas.LeaveOut)
def upsert_leave(
    nurse_id: int,
    year_month: str,
    body: schemas.LeaveUpsert,
    ward_id: int = Query(None),
    db: Session = Depends(get_db),
    current=Depends(get_current_nurse),
):
    # 본인이거나 HN만 수정 가능
    if current.id != nurse_id and current.grade != "HN":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    leave = db.query(models.NurseMonthlyLeave).filter(
        models.NurseMonthlyLeave.nurse_id == nurse_id,
        models.NurseMonthlyLeave.year_month == year_month,
    ).first()

    if not leave:
        leave = models.NurseMonthlyLeave(
            nurse_id=nurse_id,
            year_month=year_month,
        )
        db.add(leave)

    leave.annual_leave_count = body.annual_leave_count
    leave.requested_off_dates = json.dumps(body.requested_off_dates)
    db.commit()
    db.refresh(leave)

    holidays = []
    if ward_id:
        hols = db.query(models.Holiday).filter(models.Holiday.ward_id == ward_id).all()
        holidays = [h.date for h in hols]

    total = _calc_total_off(nurse_id, year_month, db, holidays)

    return schemas.LeaveOut(
        id=leave.id,
        nurse_id=nurse_id,
        year_month=year_month,
        annual_leave_count=leave.annual_leave_count,
        requested_off_dates=json.loads(leave.requested_off_dates),
        total_off_days=total,
    )


@router.get("/ward/{ward_id}/{year_month}", response_model=List[schemas.LeaveOut])
def get_ward_leaves(
    ward_id: int,
    year_month: str,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """병동 전체 간호사 연차/희망 휴일 일괄 조회"""
    nurses = db.query(models.Nurse).filter(models.Nurse.ward_id == ward_id).all()
    holidays = [h.date for h in db.query(models.Holiday).filter(models.Holiday.ward_id == ward_id).all()]

    result = []
    for nurse in nurses:
        leave = db.query(models.NurseMonthlyLeave).filter(
            models.NurseMonthlyLeave.nurse_id == nurse.id,
            models.NurseMonthlyLeave.year_month == year_month,
        ).first()
        annual = leave.annual_leave_count if leave else nurse.monthly_annual_leave
        off_dates = json.loads(leave.requested_off_dates) if leave else []
        total = _calc_total_off(nurse.id, year_month, db, holidays)
        result.append(schemas.LeaveOut(
            id=leave.id if leave else 0,
            nurse_id=nurse.id,
            year_month=year_month,
            annual_leave_count=annual,
            requested_off_dates=off_dates,
            total_off_days=total,
        ))
    return result
