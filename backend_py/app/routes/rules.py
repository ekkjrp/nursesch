"""근무 규칙 라우터"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_nurse, require_admin

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _rule_to_out(rule: models.Rule) -> schemas.RuleOut:
    try:
        weights = json.loads(rule.constraint_weights or "{}")
    except Exception:
        weights = {}
    return schemas.RuleOut(
        id=rule.id,
        ward_id=rule.ward_id,
        max_consecutive_work_days=rule.max_consecutive_work_days,
        max_consecutive_night_shifts=rule.max_consecutive_night_shifts,
        min_monthly_off_days=rule.min_monthly_off_days,
        weekday_day_charge=rule.weekday_day_charge,
        weekday_day_action=rule.weekday_day_action,
        weekday_evening_charge=rule.weekday_evening_charge,
        weekday_evening_action=rule.weekday_evening_action,
        weekday_night_charge=rule.weekday_night_charge,
        weekday_night_action=rule.weekday_night_action,
        weekend_day_charge=rule.weekend_day_charge,
        weekend_day_action=rule.weekend_day_action,
        weekend_evening_charge=rule.weekend_evening_charge,
        weekend_evening_action=rule.weekend_evening_action,
        weekend_night_charge=rule.weekend_night_charge,
        weekend_night_action=rule.weekend_night_action,
        allow_night_to_day=rule.allow_night_to_day,
        allow_night_to_evening=rule.allow_night_to_evening,
        allow_night_off_day=rule.allow_night_off_day,
        an_auto_weekend_off=rule.an_auto_weekend_off,
        constraint_weights=weights,
    )


@router.get("/ward/{ward_id}", response_model=schemas.RuleOut)
def get_rule(ward_id: int, db: Session = Depends(get_db), _=Depends(get_current_nurse)):
    rule = db.query(models.Rule).filter(models.Rule.ward_id == ward_id).first()
    if not rule:
        # 없으면 기본 규칙 자동 생성
        rule = models.Rule(ward_id=ward_id)
        db.add(rule)
        db.commit()
        db.refresh(rule)
    return _rule_to_out(rule)


@router.put("/ward/{ward_id}", response_model=schemas.RuleOut)
def update_rule(
    ward_id: int,
    body: schemas.RuleUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    rule = db.query(models.Rule).filter(models.Rule.ward_id == ward_id).first()
    if not rule:
        rule = models.Rule(ward_id=ward_id)
        db.add(rule)

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "constraint_weights":
            setattr(rule, field, json.dumps(value))
        else:
            setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return _rule_to_out(rule)
