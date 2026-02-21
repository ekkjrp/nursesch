"""근무 요청 라우터"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin

router = APIRouter(prefix="/api/requests", tags=["requests"])

MAX_REQUESTS_PER_MONTH = 2


def _to_out(req: models.ShiftRequest, db: Session) -> schemas.ShiftRequestOut:
    nurse = db.query(models.Nurse).filter(models.Nurse.id == req.nurse_id).first()
    return schemas.ShiftRequestOut(
        id=req.id,
        nurse_id=req.nurse_id,
        schedule_id=req.schedule_id,
        date=req.date,
        requested_shift_type=req.requested_shift_type,
        status=req.status,
        is_admin_set=req.is_admin_set,
        reason=req.reason,
        nurse_name=nurse.name if nurse else None,
        created_at=req.created_at,
    )


@router.get("", response_model=List[schemas.ShiftRequestOut])
def list_requests(
    year_month: Optional[str] = Query(None),
    nurse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current=Depends(get_current_nurse),
):
    q = db.query(models.ShiftRequest)
    # 일반 간호사는 본인 요청만 조회
    if current.grade != "HN":
        q = q.filter(models.ShiftRequest.nurse_id == current.id)
    elif nurse_id:
        q = q.filter(models.ShiftRequest.nurse_id == nurse_id)

    if year_month:
        q = q.filter(models.ShiftRequest.date.startswith(year_month))

    return [_to_out(r, db) for r in q.order_by(models.ShiftRequest.created_at.desc()).all()]


@router.post("", response_model=schemas.ShiftRequestOut)
def create_request(
    body: schemas.ShiftRequestCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_nurse),
):
    """간호사 본인 근무 요청 (월 최대 2건)"""
    year_month = body.year_month
    existing = db.query(models.ShiftRequest).filter(
        models.ShiftRequest.nurse_id == current.id,
        models.ShiftRequest.date.startswith(year_month),
        models.ShiftRequest.is_admin_set == False,
    ).count()
    if existing >= MAX_REQUESTS_PER_MONTH:
        raise HTTPException(status_code=400, detail=f"월 최대 {MAX_REQUESTS_PER_MONTH}건까지 요청할 수 있습니다.")

    req = models.ShiftRequest(
        nurse_id=current.id,
        date=body.date,
        requested_shift_type=body.requested_shift_type,
        reason=body.reason,
        status="PENDING",
        is_admin_set=False,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req, db)


@router.post("/admin", response_model=schemas.ShiftRequestOut)
def admin_create_request(
    body: schemas.ShiftRequestAdminCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """HN이 간호사 근무/희망 휴일을 직접 지정 (is_admin_set=True, 자동 APPROVED)"""
    req = models.ShiftRequest(
        nurse_id=body.nurse_id,
        date=body.date,
        requested_shift_type=body.requested_shift_type,
        reason=body.reason,
        status="APPROVED",
        is_admin_set=True,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req, db)


@router.put("/{req_id}/approve", response_model=schemas.ShiftRequestOut)
def approve_request(req_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    req = db.query(models.ShiftRequest).filter(models.ShiftRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다.")
    req.status = "APPROVED"
    db.commit()
    return _to_out(req, db)


@router.put("/{req_id}/reject", response_model=schemas.ShiftRequestOut)
def reject_request(req_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    req = db.query(models.ShiftRequest).filter(models.ShiftRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다.")
    req.status = "REJECTED"
    db.commit()
    return _to_out(req, db)


@router.put("/{req_id}", response_model=schemas.ShiftRequestOut)
def update_request(
    req_id: int,
    body: schemas.ShiftRequestUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_nurse),
):
    """근무 요청 수정 (날짜, 근무유형 변경)"""
    req = db.query(models.ShiftRequest).filter(models.ShiftRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다.")
    if current.grade != "HN" and req.nurse_id != current.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    if body.date is not None:
        req.date = body.date
    if body.requested_shift_type is not None:
        req.requested_shift_type = body.requested_shift_type
    db.commit()
    db.refresh(req)
    return _to_out(req, db)


@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db), current=Depends(get_current_nurse)):
    req = db.query(models.ShiftRequest).filter(models.ShiftRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="요청을 찾을 수 없습니다.")
    if current.grade != "HN" and req.nurse_id != current.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    db.delete(req)
    db.commit()
    return {"message": "삭제되었습니다."}
