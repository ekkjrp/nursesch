"""SQLAlchemy ORM 모델 — designreq.md v1.1 기반"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class Ward(Base):
    __tablename__ = "wards"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nurses = relationship("Nurse", back_populates="ward", cascade="all, delete-orphan")
    rule = relationship("Rule", back_populates="ward", uselist=False, cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="ward", cascade="all, delete-orphan")
    holidays = relationship("Holiday", back_populates="ward", cascade="all, delete-orphan")


class Nurse(Base):
    __tablename__ = "nurses"
    id = Column(Integer, primary_key=True, index=True)
    ward_id = Column(Integer, ForeignKey("wards.id"), nullable=False)
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    # 직급: HN(수간호사/관리자), CN(책임간호사), RN(평간호사), AN(보조간호사)
    grade = Column(String(10), nullable=False, default="RN")
    sort_order = Column(Integer, default=0)          # 관리자 지정 정렬 순서
    is_night_dedicated = Column(Boolean, default=False)  # 나이트 전담 여부
    monthly_annual_leave = Column(Integer, default=1)    # 월 기본 연차수
    password_hash = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ward = relationship("Ward", back_populates="nurses")
    entries = relationship("ScheduleEntry", back_populates="nurse", cascade="all, delete-orphan")
    shift_requests = relationship("ShiftRequest", back_populates="nurse", cascade="all, delete-orphan")
    monthly_leaves = relationship("NurseMonthlyLeave", back_populates="nurse", cascade="all, delete-orphan")


class Rule(Base):
    __tablename__ = "rules"
    id = Column(Integer, primary_key=True, index=True)
    ward_id = Column(Integer, ForeignKey("wards.id"), unique=True, nullable=False)
    max_consecutive_work_days = Column(Integer, default=5)
    max_consecutive_night_shifts = Column(Integer, default=3)
    min_monthly_off_days = Column(Integer, default=8)
    # 평일 Charge(HN/CN) 인원 + Action(RN) 인원 (데이/이브닝/나이트 각각)
    weekday_day_charge = Column(Integer, default=1)
    weekday_day_action = Column(Integer, default=2)
    weekday_evening_charge = Column(Integer, default=1)
    weekday_evening_action = Column(Integer, default=1)
    weekday_night_charge = Column(Integer, default=1)
    weekday_night_action = Column(Integer, default=1)
    # 주말 인원
    weekend_day_charge = Column(Integer, default=1)
    weekend_day_action = Column(Integer, default=1)
    weekend_evening_charge = Column(Integer, default=1)
    weekend_evening_action = Column(Integer, default=1)
    weekend_night_charge = Column(Integer, default=1)
    weekend_night_action = Column(Integer, default=1)
    # 금지 전환 패턴 (False=금지)
    allow_night_to_day = Column(Boolean, default=False)
    allow_night_to_evening = Column(Boolean, default=False)
    allow_night_off_day = Column(Boolean, default=False)
    # AN 주말 자동 Off (True=자동 Off)
    an_auto_weekend_off = Column(Boolean, default=True)
    # 제약 가중치 (JSON 문자열)
    constraint_weights = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ward = relationship("Ward", back_populates="rule")


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    ward_id = Column(Integer, ForeignKey("wards.id"), nullable=False)
    year_month = Column(String(7), nullable=False)   # YYYY-MM
    status = Column(String(20), default="DRAFT")     # DRAFT | CONFIRMED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ward = relationship("Ward", back_populates="schedules")
    entries = relationship("ScheduleEntry", back_populates="schedule", cascade="all, delete-orphan")
    shift_requests = relationship("ShiftRequest", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    nurse_id = Column(Integer, ForeignKey("nurses.id"), nullable=False)
    date = Column(String(10), nullable=False)         # YYYY-MM-DD
    # D=데이, E=이브닝, N=나이트, M=미드(AN기본), O=오프, Y=연차, X=기타
    shift_type = Column(String(5), nullable=False)
    is_manually_edited = Column(Boolean, default=False)

    schedule = relationship("Schedule", back_populates="entries")
    nurse = relationship("Nurse", back_populates="entries")


class ShiftRequest(Base):
    __tablename__ = "shift_requests"
    id = Column(Integer, primary_key=True, index=True)
    nurse_id = Column(Integer, ForeignKey("nurses.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)
    date = Column(String(10), nullable=False)
    requested_shift_type = Column(String(5), nullable=False)
    status = Column(String(20), default="PENDING")   # PENDING | APPROVED | REJECTED
    is_admin_set = Column(Boolean, default=False)    # HN이 직접 지정 여부
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nurse = relationship("Nurse", back_populates="shift_requests")
    schedule = relationship("Schedule", back_populates="shift_requests")


class NurseMonthlyLeave(Base):
    """간호사 월별 연차/희망 휴일 설정"""
    __tablename__ = "nurse_monthly_leaves"
    id = Column(Integer, primary_key=True, index=True)
    nurse_id = Column(Integer, ForeignKey("nurses.id"), nullable=False)
    year_month = Column(String(7), nullable=False)   # YYYY-MM
    annual_leave_count = Column(Integer, default=1)  # 해당월 연차수
    requested_off_dates = Column(Text, default="[]") # JSON 날짜 목록
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    nurse = relationship("Nurse", back_populates="monthly_leaves")


class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True, index=True)
    ward_id = Column(Integer, ForeignKey("wards.id"), nullable=False)
    date = Column(String(10), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(20), default="HOLIDAY")     # HOLIDAY | EDUCATION | OTHER

    ward = relationship("Ward", back_populates="holidays")
