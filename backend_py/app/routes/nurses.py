"""간호사 라우터 — CRUD, 정렬 순서 관리"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin, hash_password

router = APIRouter(prefix="/api/nurses", tags=["nurses"])

GRADE_ORDER = {"HN": 0, "CN": 1, "RN": 2, "AN": 3}


def _sort_nurses(nurses: List[models.Nurse], sort_by: str = "sort_order") -> List[models.Nurse]:
    """
    정렬 우선순위: 관리자 지정 sort_order 먼저, 그 다음 요청한 기준
    sort_order=0이면 지정 없음으로 취급해 맨 뒤로
    """
    def key_fn(n):
        custom = n.sort_order if n.sort_order > 0 else 99999
        if sort_by == "name":
            return (custom, n.name)
        elif sort_by == "email":
            return (custom, n.email)
        elif sort_by == "grade":
            return (custom, GRADE_ORDER.get(n.grade, 9))
        return (custom, n.name)

    return sorted(nurses, key=key_fn)


@router.get("", response_model=List[schemas.NurseOut])
def list_nurses(
    ward_id: Optional[int] = Query(None),
    sort_by: str = Query("sort_order"),
    db: Session = Depends(get_db),
    _=Depends(get_current_nurse),
):
    q = db.query(models.Nurse)
    if ward_id:
        q = q.filter(models.Nurse.ward_id == ward_id)
    nurses = q.all()
    return _sort_nurses(nurses, sort_by)


@router.post("", response_model=schemas.NurseOut)
def create_nurse(
    body: schemas.NurseCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if db.query(models.Nurse).filter(models.Nurse.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    # ward_id는 현재 관리자의 병동 사용 (body에 없으면 관리자 병동)
    ward = db.query(models.Ward).first()
    if not ward:
        raise HTTPException(status_code=400, detail="병동이 없습니다. 먼저 병동을 등록하세요.")

    # sort_order 미지정 시 현재 최대값+1
    if body.sort_order == 0:
        max_order = db.query(models.Nurse).filter(
            models.Nurse.ward_id == ward.id
        ).count()
        sort_order = max_order + 1
    else:
        sort_order = body.sort_order

    nurse = models.Nurse(
        ward_id=ward.id,
        name=body.name,
        email=body.email,
        grade=body.grade,
        sort_order=sort_order,
        is_night_dedicated=body.is_night_dedicated,
        monthly_annual_leave=body.monthly_annual_leave,
        password_hash=hash_password(body.password),
    )
    db.add(nurse)
    db.commit()
    db.refresh(nurse)
    return nurse


@router.put("/reorder", response_model=List[schemas.NurseOut])
def reorder_nurses(
    items: List[schemas.NurseReorderItem],
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """관리자가 지정한 정렬 순서를 일괄 업데이트"""
    for item in items:
        nurse = db.query(models.Nurse).filter(models.Nurse.id == item.id).first()
        if nurse:
            nurse.sort_order = item.sort_order
    db.commit()
    nurses = db.query(models.Nurse).all()
    return _sort_nurses(nurses)


@router.put("/{nurse_id}", response_model=schemas.NurseOut)
def update_nurse(
    nurse_id: int,
    body: schemas.NurseUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    nurse = db.query(models.Nurse).filter(models.Nurse.id == nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="간호사를 찾을 수 없습니다.")

    if body.email and body.email != nurse.email:
        if db.query(models.Nurse).filter(models.Nurse.email == body.email).first():
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        nurse.email = body.email

    if body.name is not None:
        nurse.name = body.name
    if body.grade is not None:
        nurse.grade = body.grade
    if body.sort_order is not None:
        nurse.sort_order = body.sort_order
    if body.is_night_dedicated is not None:
        nurse.is_night_dedicated = body.is_night_dedicated
    if body.monthly_annual_leave is not None:
        nurse.monthly_annual_leave = body.monthly_annual_leave
    if body.password:
        nurse.password_hash = hash_password(body.password)

    db.commit()
    db.refresh(nurse)
    return nurse


@router.delete("/{nurse_id}")
def delete_nurse(
    nurse_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    nurse = db.query(models.Nurse).filter(models.Nurse.id == nurse_id).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="간호사를 찾을 수 없습니다.")
    db.delete(nurse)
    db.commit()
    return {"message": "삭제되었습니다."}
