"""제약 조건 검증기 — Scheduling Engine과 분리된 독립 모듈"""
from typing import List, Dict, Any
from dataclasses import dataclass, field
import calendar
from datetime import date as dt_date
import statistics

CHARGE_GRADES = {"HN", "CN"}
ACTION_GRADES = {"RN"}
WORK_SHIFTS = {"D", "E", "N", "M"}  # 실제 근무 (O, Y, X 제외)


@dataclass
class Violation:
    type: str      # HARD | SOFT
    rule: str
    message: str
    nurse_id: int = None
    date: str = None


def _is_weekend(date_str: str) -> bool:
    d = dt_date.fromisoformat(date_str)
    return d.weekday() >= 5  # 5=토, 6=일


def _is_off_day(date_str: str, holidays: List[str]) -> bool:
    return _is_weekend(date_str) or date_str in holidays


def validate_schedule(
    entries: List[Dict],
    nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str] = None,
) -> Dict:
    """전체 근무표 검증. 위반 목록과 총 페널티 점수 반환"""
    if holidays is None:
        holidays = []

    violations: List[Violation] = []

    # schedule[nurse_id][date] = shift_type
    schedule: Dict[int, Dict[str, str]] = {}
    for e in entries:
        schedule.setdefault(e["nurse_id"], {})[e["date"]] = e["shift_type"]

    nurse_map = {n["id"]: n for n in nurses}

    year, month = map(int, year_month.split("-"))
    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [f"{year_month}-{d:02d}" for d in range(1, days_in_month + 1)]

    # HC-1: 근무조별 Charge/Action 인원 충족
    for date in all_dates:
        is_wknd = _is_off_day(date, holidays)
        prefix = "weekend" if is_wknd else "weekday"
        for shift, col in [("D", "day"), ("E", "evening"), ("N", "night")]:
            workers = [
                nurse_map[nid]
                for nid, shifts in schedule.items()
                if shifts.get(date) == shift and nid in nurse_map
            ]
            charge_cnt = sum(1 for n in workers if n.get("grade") in CHARGE_GRADES)
            action_cnt = sum(1 for n in workers if n.get("grade") in ACTION_GRADES)

            req_charge = rule.get(f"{prefix}_{col}_charge", 1)
            req_action = rule.get(f"{prefix}_{col}_action", 1)

            if charge_cnt < req_charge:
                violations.append(Violation(
                    type="HARD", rule="HC-1",
                    message=f"{date} {shift}근무 Charge 인원 부족 ({charge_cnt}/{req_charge})",
                    date=date
                ))
            if action_cnt < req_action:
                violations.append(Violation(
                    type="HARD", rule="HC-1",
                    message=f"{date} {shift}근무 Action 인원 부족 ({action_cnt}/{req_action})",
                    date=date
                ))

    # HC-2: 최대 연속 근무일
    max_consec = rule.get("max_consecutive_work_days", 5)
    for nid, shifts in schedule.items():
        consec = 0
        for date in all_dates:
            st = shifts.get(date, "O")
            if st in WORK_SHIFTS:
                consec += 1
                if consec > max_consec:
                    violations.append(Violation(
                        type="HARD", rule="HC-2",
                        message=f"간호사 {nid}: {date} 연속근무 {consec}일 (최대 {max_consec}일)",
                        nurse_id=nid, date=date
                    ))
            else:
                consec = 0

    # HC-3: 금지 전환 패턴 (N->D, N->E, N->O->D)
    allow_nd = rule.get("allow_night_to_day", False)
    allow_ne = rule.get("allow_night_to_evening", False)
    allow_nod = rule.get("allow_night_off_day", False)

    for nid, shifts in schedule.items():
        for i, date in enumerate(all_dates[:-1]):
            next_date = all_dates[i + 1]
            cur = shifts.get(date, "O")
            nxt = shifts.get(next_date, "O")

            if cur == "N" and not allow_nd and nxt == "D":
                violations.append(Violation(
                    type="HARD", rule="HC-3",
                    message=f"간호사 {nid}: {date} N->D 금지 패턴",
                    nurse_id=nid, date=date
                ))
            if cur == "N" and not allow_ne and nxt == "E":
                violations.append(Violation(
                    type="HARD", rule="HC-3",
                    message=f"간호사 {nid}: {date} N->E 금지 패턴",
                    nurse_id=nid, date=date
                ))
            if i < len(all_dates) - 2 and not allow_nod:
                day2 = all_dates[i + 2]
                nxt2 = shifts.get(day2, "O")
                if cur == "N" and nxt in ("O", "Y") and nxt2 == "D":
                    violations.append(Violation(
                        type="HARD", rule="HC-3",
                        message=f"간호사 {nid}: {date} N->O->D 금지 패턴",
                        nurse_id=nid, date=date
                    ))

    # HC-4: 나이트 단독(1일) 및 연속 4일이상 금지
    for nid, shifts in schedule.items():
        night_run = 0
        for i, date in enumerate(all_dates):
            if shifts.get(date, "O") == "N":
                night_run += 1
                if night_run >= 4:
                    violations.append(Violation(
                        type="HARD", rule="HC-4",
                        message=f"간호사 {nid}: {date} 연속 나이트 {night_run}일",
                        nurse_id=nid, date=date
                    ))
            else:
                if night_run == 1:
                    prev_date = all_dates[i - 1]
                    violations.append(Violation(
                        type="HARD", rule="HC-4",
                        message=f"간호사 {nid}: {prev_date} 나이트 단독 근무",
                        nurse_id=nid, date=prev_date
                    ))
                night_run = 0

    # HC-5: 나이트 전담 준수
    for nid, shifts in schedule.items():
        nurse = nurse_map.get(nid)
        if not nurse or not nurse.get("is_night_dedicated"):
            continue
        for date, st in shifts.items():
            if st not in ("N", "O", "Y", "X"):
                violations.append(Violation(
                    type="HARD", rule="HC-5",
                    message=f"간호사 {nid}(나이트전담): {date} N외 근무({st})",
                    nurse_id=nid, date=date
                ))

    # HC-6: AN 주말 자동 Off
    if rule.get("an_auto_weekend_off", True):
        for nid, shifts in schedule.items():
            nurse = nurse_map.get(nid)
            if not nurse or nurse.get("grade") != "AN":
                continue
            for date, st in shifts.items():
                if _is_weekend(date) and st in WORK_SHIFTS:
                    violations.append(Violation(
                        type="HARD", rule="HC-6",
                        message=f"AN 간호사 {nid}: {date} 주말 근무 배정",
                        nurse_id=nid, date=date
                    ))

    # SC-2: 근무 횟수 균등 (페널티)
    score = sum(1000.0 for v in violations if v.type == "HARD")
    work_counts = {
        nid: sum(1 for st in shifts.values() if st in WORK_SHIFTS)
        for nid, shifts in schedule.items()
    }
    if len(work_counts) > 1:
        try:
            score += statistics.stdev(work_counts.values()) * 50
        except statistics.StatisticsError:
            pass

    hard_cnt = sum(1 for v in violations if v.type == "HARD")
    soft_cnt = sum(1 for v in violations if v.type == "SOFT")

    return {
        "violations": [
            {"type": v.type, "rule": v.rule, "message": v.message,
             "nurse_id": v.nurse_id, "date": v.date}
            for v in violations
        ],
        "total_score": score,
        "hard_count": hard_cnt,
        "soft_count": soft_cnt,
    }
