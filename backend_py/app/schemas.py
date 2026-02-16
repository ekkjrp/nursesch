"""Pydantic 스키마 — API 요청/응답 형식 정의"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ── Ward ──────────────────────────────────────────────────────────────────────
class WardCreate(BaseModel):
    name: str

class WardUpdate(BaseModel):
    name: str

class WardOut(BaseModel):
    id: int
    name: str
    nurse_count: int = 0
    model_config = {"from_attributes": True}


# ── Nurse ─────────────────────────────────────────────────────────────────────
class NurseCreate(BaseModel):
    name: str
    email: str
    password: str
    grade: str = "RN"          # HN | CN | RN | AN
    sort_order: int = 0
    is_night_dedicated: bool = False
    monthly_annual_leave: int = 1

class NurseUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    grade: Optional[str] = None
    sort_order: Optional[int] = None
    is_night_dedicated: Optional[bool] = None
    monthly_annual_leave: Optional[int] = None

class NurseOut(BaseModel):
    id: int
    ward_id: int
    name: str
    email: str
    grade: str
    sort_order: int
    is_night_dedicated: bool
    monthly_annual_leave: int
    model_config = {"from_attributes": True}

class NurseReorderItem(BaseModel):
    id: int
    sort_order: int


# ── Rule ──────────────────────────────────────────────────────────────────────
class RuleUpdate(BaseModel):
    max_consecutive_work_days: Optional[int] = None
    max_consecutive_night_shifts: Optional[int] = None
    min_monthly_off_days: Optional[int] = None
    weekday_day_charge: Optional[int] = None
    weekday_day_action: Optional[int] = None
    weekday_evening_charge: Optional[int] = None
    weekday_evening_action: Optional[int] = None
    weekday_night_charge: Optional[int] = None
    weekday_night_action: Optional[int] = None
    weekend_day_charge: Optional[int] = None
    weekend_day_action: Optional[int] = None
    weekend_evening_charge: Optional[int] = None
    weekend_evening_action: Optional[int] = None
    weekend_night_charge: Optional[int] = None
    weekend_night_action: Optional[int] = None
    allow_night_to_day: Optional[bool] = None
    allow_night_to_evening: Optional[bool] = None
    allow_night_off_day: Optional[bool] = None
    an_auto_weekend_off: Optional[bool] = None
    constraint_weights: Optional[dict] = None

class RuleOut(BaseModel):
    id: int
    ward_id: int
    max_consecutive_work_days: int
    max_consecutive_night_shifts: int
    min_monthly_off_days: int
    weekday_day_charge: int
    weekday_day_action: int
    weekday_evening_charge: int
    weekday_evening_action: int
    weekday_night_charge: int
    weekday_night_action: int
    weekend_day_charge: int
    weekend_day_action: int
    weekend_evening_charge: int
    weekend_evening_action: int
    weekend_night_charge: int
    weekend_night_action: int
    allow_night_to_day: bool
    allow_night_to_evening: bool
    allow_night_off_day: bool
    an_auto_weekend_off: bool
    constraint_weights: dict = {}
    model_config = {"from_attributes": True}


# ── Schedule ──────────────────────────────────────────────────────────────────
class ScheduleGenerateRequest(BaseModel):
    ward_id: int
    year_month: str   # YYYY-MM
    prev_month_entries: List[dict] = []

class ScheduleOut(BaseModel):
    id: int
    ward_id: int
    year_month: str
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}

class EntryOut(BaseModel):
    id: int
    nurse_id: int
    date: str
    shift_type: str
    is_manually_edited: bool
    model_config = {"from_attributes": True}

class EntryUpdate(BaseModel):
    shift_type: str

class ScheduleWithEntries(BaseModel):
    schedule: ScheduleOut
    entries: List[EntryOut]


# ── ShiftRequest ──────────────────────────────────────────────────────────────
class ShiftRequestCreate(BaseModel):
    date: str
    requested_shift_type: str
    reason: Optional[str] = None
    year_month: str    # 어느 월 근무표에 대한 요청인지

class ShiftRequestAdminCreate(BaseModel):
    """관리자(HN)가 직접 지정하는 근무 요청"""
    nurse_id: int
    date: str
    requested_shift_type: str
    reason: Optional[str] = None
    year_month: str

class ShiftRequestOut(BaseModel):
    id: int
    nurse_id: int
    schedule_id: Optional[int]
    date: str
    requested_shift_type: str
    status: str
    is_admin_set: bool
    reason: Optional[str]
    nurse_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── NurseMonthlyLeave ─────────────────────────────────────────────────────────
class LeaveUpsert(BaseModel):
    annual_leave_count: int = 1
    requested_off_dates: List[str] = []   # ["YYYY-MM-DD", ...]

class LeaveOut(BaseModel):
    id: int
    nurse_id: int
    year_month: str
    annual_leave_count: int
    requested_off_dates: List[str] = []
    total_off_days: int = 0    # 주말 + 공휴일 + 연차 계산 결과
    model_config = {"from_attributes": True}


# ── Holiday ───────────────────────────────────────────────────────────────────
class HolidayCreate(BaseModel):
    date: str
    name: str
    type: str = "HOLIDAY"

class HolidayOut(BaseModel):
    id: int
    ward_id: int
    date: str
    name: str
    type: str
    model_config = {"from_attributes": True}


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    nurse: NurseOut


# ── Validation ────────────────────────────────────────────────────────────────
class ViolationOut(BaseModel):
    type: str        # HARD | SOFT
    rule: str
    message: str
    nurse_id: Optional[int] = None
    date: Optional[str] = None

class ValidationResult(BaseModel):
    violations: List[ViolationOut]
    total_score: float
    hard_count: int
    soft_count: int


# ── Stats ─────────────────────────────────────────────────────────────────────
class NurseStats(BaseModel):
    nurse_id: int
    nurse_name: str
    grade: str
    d_count: int = 0
    e_count: int = 0
    n_count: int = 0
    m_count: int = 0
    o_count: int = 0
    y_count: int = 0
    weekend_work: int = 0
    total_off: int = 0
