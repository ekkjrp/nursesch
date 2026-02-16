"""SA 스케줄링 엔진 — Simulated Annealing 기반 근무표 자동 생성"""
import random
import math
import calendar
from copy import deepcopy
from datetime import date as dt_date
from typing import List, Dict, Optional, Tuple
from app.engine.validator import validate_schedule, CHARGE_GRADES, ACTION_GRADES, WORK_SHIFTS, _is_weekend, _is_off_day

# SA 기본 파라미터
INITIAL_TEMPERATURE = 1000.0
COOLING_RATE = 0.9993
MAX_ITERATIONS = 15000
MAX_NO_IMPROVEMENT = 1500


def _days_in_month(year_month: str) -> List[str]:
    year, month = map(int, year_month.split("-"))
    n = calendar.monthrange(year, month)[1]
    return [f"{year_month}-{d:02d}" for d in range(1, n + 1)]


def _is_workday(date_str: str, holidays: List[str]) -> bool:
    """평일 근무일 여부"""
    return not _is_off_day(date_str, holidays)


def _calc_target_off_days(
    nurse: Dict,
    year_month: str,
    holidays: List[str],
    leave_map: Dict[int, Dict],
) -> int:
    """
    간호사별 총 목표 비근무일수 계산:
    주말일수 + 공휴일수(중복제거) + 연차수
    """
    year, month = map(int, year_month.split("-"))
    n = calendar.monthrange(year, month)[1]
    all_dates = [f"{year_month}-{d:02d}" for d in range(1, n + 1)]

    weekend_cnt = sum(1 for d in all_dates if _is_weekend(d))
    holiday_cnt = sum(1 for d in holidays if d.startswith(year_month) and not _is_weekend(d))

    # 개인 연차수 (월별 설정 우선, 없으면 기본값)
    leave_info = leave_map.get(nurse["id"], {})
    annual = leave_info.get("annual_leave_count", nurse.get("monthly_annual_leave", 1))

    return weekend_cnt + holiday_cnt + annual


def _create_initial_solution(
    nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str],
    approved_requests: List[Dict],
    leave_map: Dict[int, Dict],
) -> Dict[int, Dict[str, str]]:
    """
    초기 해 생성 전략 (커버리지 우선):
    1. 전체 Off로 초기화
    2. 고정 요청/희망 휴일 반영
    3. 나이트 전담 → N 배정
    4. AN → Mid 배정, 주말 Off
    5. 일반 간호사: 날짜별로 최소 Charge/Action 커버리지 보장 후 잔여 Off 배분
    """
    all_dates = _days_in_month(year_month)
    # 전체 Off로 초기화
    schedule: Dict[int, Dict[str, str]] = {n["id"]: {d: "O" for d in all_dates} for n in nurses}

    night_dedicated = [n for n in nurses if n.get("is_night_dedicated")]
    an_nurses = [n for n in nurses if n.get("grade") == "AN" and not n.get("is_night_dedicated")]
    regular_nurses = [
        n for n in nurses
        if not n.get("is_night_dedicated") and n.get("grade") != "AN"
    ]
    charge_nurses = [n for n in regular_nurses if n.get("grade") in CHARGE_GRADES]
    action_nurses = [n for n in regular_nurses if n.get("grade") in ACTION_GRADES]

    # 고정 요청/희망 휴일 선적용
    fixed: Dict[int, Dict[str, str]] = {n["id"]: {} for n in nurses}
    for req in approved_requests:
        fixed.setdefault(req["nurse_id"], {})[req["date"]] = req["requested_shift_type"]
    for nid, leave_info in leave_map.items():
        for off_date in leave_info.get("requested_off_dates", []):
            if off_date.startswith(year_month):
                fixed.setdefault(nid, {})[off_date] = "O"
    for nid, date_shifts in fixed.items():
        for date, st in date_shifts.items():
            schedule[nid][date] = st

    # 나이트 전담: 평일 N, 주말/공휴일 O
    for nurse in night_dedicated:
        nid = nurse["id"]
        for date in all_dates:
            if date in fixed.get(nid, {}):
                continue
            schedule[nid][date] = "O" if _is_off_day(date, holidays) else "N"

    # AN: 평일 M, 주말 O
    for nurse in an_nurses:
        nid = nurse["id"]
        for date in all_dates:
            if date in fixed.get(nid, {}):
                continue
            if _is_weekend(date) and rule.get("an_auto_weekend_off", True):
                schedule[nid][date] = "O"
            else:
                schedule[nid][date] = "M"

    # 일반 간호사: 날짜별 커버리지 우선 배정
    # 각 간호사별 현재까지의 근무일수 추적 (균등 배분용)
    work_count: Dict[int, int] = {n["id"]: 0 for n in regular_nurses}

    for date_idx, date in enumerate(all_dates):
        is_wknd = _is_off_day(date, holidays)
        prefix = "weekend" if is_wknd else "weekday"

        for shift, col in [("D", "day"), ("E", "evening"), ("N", "night")]:
            req_charge = rule.get(f"{prefix}_{col}_charge", 1)
            req_action = rule.get(f"{prefix}_{col}_action", 1)

            # 해당 날짜에 아직 Off인 charge 간호사 (고정 아닌 것), 근무일수 적은 순 정렬
            avail_charge = [
                n for n in charge_nurses
                if schedule[n["id"]][date] == "O" and date not in fixed.get(n["id"], {})
            ]
            avail_charge.sort(key=lambda n: work_count[n["id"]])

            avail_action = [
                n for n in action_nurses
                if schedule[n["id"]][date] == "O" and date not in fixed.get(n["id"], {})
            ]
            avail_action.sort(key=lambda n: work_count[n["id"]])

            # 최소 Charge 배정
            for i in range(min(req_charge, len(avail_charge))):
                nid = avail_charge[i]["id"]
                schedule[nid][date] = shift
                work_count[nid] += 1

            # 최소 Action 배정
            for i in range(min(req_action, len(avail_action))):
                nid = avail_action[i]["id"]
                if schedule[nid][date] == "O":  # 아직 배정 안 된 경우만
                    schedule[nid][date] = shift
                    work_count[nid] += 1

    return schedule


def _generate_neighbor(
    schedule: Dict[int, Dict[str, str]],
    nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str],
    violations: List[Dict],
) -> Dict[int, Dict[str, str]]:
    """이웃 해 생성: 50% 위반 해소 지향 / 50% 랜덤 스왑"""
    neighbor = deepcopy(schedule)
    all_dates = _days_in_month(year_month)

    # 나이트 전담 간호사 목록 (N만 가능)
    night_dedicated_ids = {n["id"] for n in nurses if n.get("is_night_dedicated")}
    an_ids = {n["id"] for n in nurses if n.get("grade") == "AN" and n["id"] not in night_dedicated_ids}

    def allowed_shifts(nid: int) -> List[str]:
        if nid in night_dedicated_ids:
            return ["N", "O"]
        if nid in an_ids:
            return ["M", "D", "E", "O", "Y"]
        return ["D", "E", "N", "O", "Y"]

    hard_violations = [v for v in violations if v.get("type") == "HARD"]

    nurse_map = {n["id"]: n for n in nurses}
    charge_grades = {"HN", "CN"}
    action_grades = {"RN"}
    regular_ids = [n["id"] for n in nurses
                   if n["id"] not in night_dedicated_ids and n["id"] not in an_ids]

    if hard_violations and random.random() < 0.5:
        # HC-1 인원 부족 → 해당 날짜/근무에 인원 보충
        hc1 = [v for v in hard_violations if v.get("rule") == "HC-1"]
        if hc1:
            v = random.choice(hc1)
            date = v.get("date")
            msg = v.get("message", "")
            # 어떤 shift/type인지 파악
            target_shift = None
            need_grade = None
            for sh in ["D", "E", "N"]:
                if f"{sh}근무" in msg:
                    target_shift = sh
                    break
            if "Charge" in msg:
                need_grade = charge_grades
            elif "Action" in msg:
                need_grade = action_grades

            if target_shift and need_grade and date:
                # 해당 날짜에 Off인 적합 간호사를 target_shift로 변경
                candidates = [
                    nid for nid in regular_ids
                    if neighbor.get(nid, {}).get(date) in ("O", "Y")
                    and nurse_map.get(nid, {}).get("grade") in need_grade
                ]
                if candidates:
                    chosen = random.choice(candidates)
                    neighbor[chosen][date] = target_shift
                    return neighbor

        # 그 외 per-nurse 위반 해소
        per_nurse = [v for v in hard_violations if v.get("nurse_id")]
        if per_nurse:
            v = random.choice(per_nurse)
            nid = v.get("nurse_id")
            date = v.get("date")
            if nid and date and nid in neighbor and date in neighbor.get(nid, {}):
                shifts = allowed_shifts(nid)
                cur = neighbor[nid][date]
                candidates = [s for s in shifts if s != cur]
                if candidates:
                    neighbor[nid][date] = random.choice(candidates)
                return neighbor

    # 랜덤 스왑: 두 간호사의 같은 날 근무 교환
    nurse_ids = list(neighbor.keys())
    if len(nurse_ids) < 2:
        return neighbor

    n1, n2 = random.sample(nurse_ids, 2)
    date = random.choice(all_dates)

    # 나이트 전담은 N/O만, AN은 AN끼리만 스왑 허용
    if n1 in night_dedicated_ids or n2 in night_dedicated_ids:
        return neighbor
    if (n1 in an_ids) != (n2 in an_ids):
        return neighbor

    if date in neighbor.get(n1, {}) and date in neighbor.get(n2, {}):
        neighbor[n1][date], neighbor[n2][date] = neighbor[n2][date], neighbor[n1][date]

    return neighbor


def generate_schedule(
    nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str],
    approved_requests: List[Dict],
    leave_map: Dict[int, Dict],
    prev_entries: List[Dict] = None,
) -> Dict:
    """
    SA 알고리즘으로 근무표 생성.
    Returns: {"entries": [...], "score": float, "violations": [...]}
    """
    if not nurses:
        return {"entries": [], "score": 0, "violations": []}

    if prev_entries is None:
        prev_entries = []

    current = _create_initial_solution(
        nurses, rule, year_month, holidays, approved_requests, leave_map
    )

    nurse_dicts = nurses  # 이미 dict 형태

    def evaluate(sol: Dict) -> Tuple[float, List[Dict]]:
        entries = [
            {"nurse_id": nid, "date": date, "shift_type": st}
            for nid, shifts in sol.items()
            for date, st in shifts.items()
        ]
        result = validate_schedule(entries, nurse_dicts, rule, year_month, holidays)
        return result["total_score"], result["violations"]

    current_score, current_violations = evaluate(current)
    best = deepcopy(current)
    best_score = current_score
    best_violations = current_violations

    temperature = INITIAL_TEMPERATURE
    no_improve = 0

    for iteration in range(MAX_ITERATIONS):
        neighbor = _generate_neighbor(
            current, nurses, rule, year_month, holidays, current_violations
        )
        n_score, n_violations = evaluate(neighbor)

        delta = n_score - current_score
        if delta < 0 or (temperature > 0.01 and random.random() < math.exp(-delta / temperature)):
            current = neighbor
            current_score = n_score
            current_violations = n_violations

            if current_score < best_score:
                best = deepcopy(current)
                best_score = current_score
                best_violations = current_violations
                no_improve = 0
            else:
                no_improve += 1
        else:
            no_improve += 1

        temperature *= COOLING_RATE

        # 재가열 (지역 최적해 탈출)
        if no_improve >= MAX_NO_IMPROVEMENT:
            temperature = INITIAL_TEMPERATURE
            no_improve = 0

        # 하드 제약 0이면 조기 종료
        if best_score < 1.0:
            break

    entries = [
        {"nurse_id": nid, "date": date, "shift_type": st}
        for nid, shifts in best.items()
        for date, st in shifts.items()
    ]
    entries.sort(key=lambda e: (e["date"], e["nurse_id"]))

    return {
        "entries": entries,
        "score": best_score,
        "violations": best_violations,
    }
