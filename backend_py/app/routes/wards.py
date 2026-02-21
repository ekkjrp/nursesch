"""병동 라우터 — CRUD"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin

router = APIRouter(prefix="/api/wards", tags=["wards"])


@router.get("", response_model=List[schemas.WardOut])
def list_wards(db: Session = Depends(get_db), _=Depends(get_current_nurse)):
    wards = db.query(models.Ward).all()
    result = []
    for w in wards:
        count = db.query(models.Nurse).filter(models.Nurse.ward_id == w.id).count()
        result.append(schemas.WardOut(id=w.id, name=w.name, nurse_count=count))
    return result


@router.post("", response_model=schemas.WardOut)
def create_ward(body: schemas.WardCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    ward = models.Ward(name=body.name)
    db.add(ward)
    db.commit()
    db.refresh(ward)
    # 기본 Rule 자동 생성
    rule = models.Rule(ward_id=ward.id)
    db.add(rule)
    db.commit()
    return schemas.WardOut(id=ward.id, name=ward.name, nurse_count=0)


@router.put("/{ward_id}", response_model=schemas.WardOut)
def update_ward(ward_id: int, body: schemas.WardUpdate,
                db: Session = Depends(get_db), _=Depends(require_admin)):
    ward = db.query(models.Ward).filter(models.Ward.id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="병동을 찾을 수 없습니다.")
    ward.name = body.name
    db.commit()
    count = db.query(models.Nurse).filter(models.Nurse.ward_id == ward_id).count()
    return schemas.WardOut(id=ward.id, name=ward.name, nurse_count=count)


@router.delete("/{ward_id}")
def delete_ward(ward_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    ward = db.query(models.Ward).filter(models.Ward.id == ward_id).first()
    if not ward:
        raise HTTPException(status_code=404, detail="병동을 찾을 수 없습니다.")
    db.delete(ward)
    db.commit()
    return {"message": "삭제되었습니다."}
