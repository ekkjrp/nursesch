"""SA 스케줄링 엔진 — Simulated Annealing 기반 근무표 자동 생성 (v1.2)
v1.2 변경사항:
- dedicated_shift 일반화 (나이트 전담 → 지정근무)
- HN Day전담 자동 처리
- PN 제외 (전부 O, 고정 요청만 반영)
- AN 분리 생성 (Phase A → Phase B)
- 선호근무 반영
- max_monthly_night_shifts 체크
"""
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


def _get_dedicated_shift(nurse: Dict) -> Optional[str]:
    """간호사의 지정근무 결정. HN은 dedicated_shift 미지정이면 D 전담 자동 적용."""
    dedicated = nurse.get("dedicated_shift")
    # backward compat
    if not dedicated and nurse.get("is_night_dedicated"):
        dedicated = "N"
    # HN Day전담: dedicated_shift 미지정이면 생성 시 D전담 처리
    if not dedicated and nurse.get("grade") == "HN":
        dedicated = "D"
    return dedicated


def _allowed_shifts_for(nurse: Dict, rule: Dict) -> List[str]:
    """간호사별 허용 근무 결정"""
    dedicated = _get_dedicated_shift(nurse)
    if dedicated:
        return [dedicated, "O"]

    grade = nurse.get("grade", "RN")
    if grade == "AN":
        return ["M", "D", "E", "O", "Y"]
    return ["D", "E", "N", "O", "Y"]


def _calc_target_off_days(
    nurse: Dict,
    year_month: str,
    holidays: List[str],
    leave_map: Dict[int, Dict],
) -> int:
    """간호사별 총 목표 비근무일수 = 주말 + 공휴일(중복제거) + 연차"""
    year, month = map(int, year_month.split("-"))
    n = calendar.monthrange(year, month)[1]
    all_dates = [f"{year_month}-{d:02d}" for d in range(1, n + 1)]

    weekend_cnt = sum(1 for d in all_dates if _is_weekend(d))
    holiday_cnt = sum(1 for d in holidays if d.startswith(year_month) and not _is_weekend(d))

    leave_info = leave_map.get(nurse["id"], {})
    # override가 있으면 사용
    override = leave_info.get("total_off_days_override")
    if override is not None:
        return override
    annual = leave_info.get("annual_leave_count", nurse.get("monthly_annual_leave", 0))
    return weekend_cnt + holiday_cnt + annual


def _create_initial_solution_phase_a(
    nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str],
    approved_requests: List[Dict],
    leave_map: Dict[int, Dict],
) -> Dict[int, Dict[str, str]]:
    """
    Phase A: HN/CN/RN 간호사 초기해 생성 (D/E/N 근무)
    - 지정근무 간호사: 해당 근무/O만 배정
    - 일반 간호사: 커버리지 우선 배정 + 선호근무 고려
    """
    all_dates = _days_in_month(year_month)
    schedule: Dict[int, Dict[str, str]] = {n["id"]: {d: "O" for d in all_dates} for n in nurses}

    # 고정 요청/희망 휴일 선적용
    fixed: Dict[int, Dict[str, str]] = {n["id"]: {} for n in nurses}
    for req in approved_requests:
        if req["nurse_id"] in fixed:
            fixed[req["nurse_id"]][req["date"]] = req["requested_shift_type"]
    for nid, leave_info in leave_map.items():
        if nid in fixed:
            for off_date in leave_info.get("requested_off_dates", []):
                if off_date.startswith(year_month):
                    fixed[nid][off_date] = "O"
    for nid, date_shifts in fixed.items():
        for date, st in date_shifts.items():
            if nid in schedule and date in schedule[nid]:
                schedule[nid][date] = st

    # 지정근무 간호사 배정
    dedicated_nurses = [n for n in nurses if _get_dedicated_shift(n)]
    for nurse in dedicated_nurses:
        nid = nurse["id"]
        dedicated = _get_dedicated_shift(nurse)
        for date in all_dates:
            if date in fixed.get(nid, {}):
                continue
            schedule[nid][date] = "O" if _is_off_day(date, holidays) else dedicated

    # 비지정근무 일반 간호사 분류
    regular_nurses = [n for n in nurses if not _get_dedicated_shift(n)]
    charge_nurses = [n for n in regular_nurses if n.get("grade") in CHARGE_GRADES]
    action_nurses = [n for n in regular_nurses if n.get("grade") in ACTION_GRADES]

    work_count: Dict[int, int] = {n["id"]: 0 for n in regular_nurses}

    for date in all_dates:
        is_wknd = _is_off_day(date, holidays)
        prefix = "weekend" if is_wknd else "weekday"

        for shift, col in [("D", "day"), ("E", "evening"), ("N", "night")]:
            # 이미 지정근무로 배정된 인원 계산
            existing_charge = sum(
                1 for n in dedicated_nurses
                if n.get("grade") in CHARGE_GRADES and schedule[n["id"]][date] == shift
            )
            existing_action = sum(
                1 for n in dedicated_nurses
                if n.get("grade") in ACTION_GRADES and schedule[n["id"]][date] == shift
            )

            req_charge = max(0, rule.get(f"{prefix}_{col}_charge", 1) - existing_charge)
            req_action = max(0, rule.get(f"{prefix}_{col}_action", 1) - existing_action)

            # 선호근무 고려: 주말/평일 선호가 이 shift인 간호사 우선
            pref_key = "weekend_preference" if is_wknd else "weekday_preference"

            avail_charge = [
                n for n in charge_nurses
                if schedule[n["id"]][date] == "O" and date not in fixed.get(n["id"], {})
            ]
            # 선호 일치하는 간호사 우선, 그 다음 근무일수 적은 순
            avail_charge.sort(key=lambda n: (
                0 if n.get(pref_key) == shift else 1,
                work_count.get(n["id"], 0),
            ))

            avail_action = [
                n for n in action_nurses
                if schedule[n["id"]][date] == "O" and date not in fixed.get(n["id"], {})
            ]
            avail_action.sort(key=lambda n: (
                0 if n.get(pref_key) == shift else 1,
                work_count.get(n["id"], 0),
            ))

            for i in range(min(req_charge, len(avail_charge))):
                nid = avail_charge[i]["id"]
                schedule[nid][date] = shift
                work_count[nid] = work_count.get(nid, 0) + 1

            for i in range(min(req_action, len(avail_action))):
                nid = avail_action[i]["id"]
                if schedule[nid][date] == "O":
                    schedule[nid][date] = shift
                    work_count[nid] = work_count.get(nid, 0) + 1

    return schedule


def _create_initial_solution_phase_b(
    an_nurses: List[Dict],
    rule: Dict,
    year_month: str,
    holidays: List[str],
    approved_requests: List[Dict],
    leave_map: Dict[int, Dict],
) -> Dict[int, Dict[str, str]]:
    """Phase B: AN 간호사 초기해 생성 (M 우선)"""
    all_dates = _days_in_month(year_month)
    schedule: Dict[int, Dict[str, str]] = {n["id"]: {d: "O" for d in all_dates} for n in an_nurses}

    fixed: Dict[int, Dict[str, str]] = {n["id"]: {} for n in an_nurses}
    for req in approved_requests:
        if req["nurse_id"] in fixed:
            fixed[req["nurse_id"]][req["date"]] = req["requested_shift_type"]
    for nid, leave_info in leave_map.items():
        if nid in fixed:
            for off_date in leave_info.get("requested_off_dates", []):
                if off_date.startswith(year_month):
                    fixed[nid][off_date] = "O"
    for nid, date_shifts in fixed.items():
        for date, st in date_shifts.items():
            if nid in schedule and date in schedule[nid]:
                schedule[nid][date] = st

    for nurse in an_nurses:
        nid = nurse["id"]
        for date in all_dates:
            if date in fixed.get(nid, {}):
                continue
            if _is_weekend(date) and rule.get("an_auto_weekend_off", True):
                schedule[nid][date] = "O"
            else:
                schedule[nid][date] = "M"

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

    # 간호사별 허용 근무 맵
    nurse_map = {n["id"]: n for n in nurses}
    dedicated_ids = {n["id"] for n in nurses if _get_dedicated_shift(n)}
    an_ids = {n["id"] for n in nurses if n.get("grade") == "AN" and n["id"] not in dedicated_ids}

    def allowed_shifts(nid: int) -> List[str]:
        nurse = nurse_map.get(nid)
        if nurse:
            return _allowed_shifts_for(nurse, rule)
        return ["D", "E", "N", "O", "Y"]

    hard_violations = [v for v in violations if v.get("type") == "HARD"]

    charge_grades = {"HN", "CN"}
    action_grades = {"RN"}
    regular_ids = [n["id"] for n in nurses
                   if n["id"] not in dedicated_ids and n["id"] not in an_ids]

    max_night = rule.get("max_monthly_night_shifts", 0)

    if hard_violations and random.random() < 0.5:
        # HC-1 인원 부족 → 해당 날짜/근무에 인원 보충
        hc1 = [v for v in hard_violations if v.get("rule") == "HC-1"]
        if hc1:
            v = random.choice(hc1)
            date = v.get("date")
            msg = v.get("message", "")
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
                candidates = [
                    nid for nid in regular_ids
                    if neighbor.get(nid, {}).get(date) in ("O", "Y")
                    and nurse_map.get(nid, {}).get("grade") in need_grade
                    and target_shift in allowed_shifts(nid)
                ]
                # max_monthly_night_shifts 체크
                if target_shift == "N" and max_night > 0:
                    candidates = [
                        nid for nid in candidates
                        if sum(1 for st in neighbor.get(nid, {}).values() if st == "N") < max_night
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
                    new_shift = random.choice(candidates)
                    # max_monthly_night_shifts 체크
                    if new_shift == "N" and max_night > 0:
                        if sum(1 for st in neighbor[nid].values() if st == "N") >= max_night:
                            candidates = [s for s in candidates if s != "N"]
                            if not candidates:
                                return neighbor
                            new_shift = random.choice(candidates)
                    neighbor[nid][date] = new_shift
                return neighbor

    # 랜덤 스왑: 두 간호사의 같은 날 근무 교환
    nurse_ids = list(neighbor.keys())
    if len(nurse_ids) < 2:
        return neighbor

    n1, n2 = random.sample(nurse_ids, 2)
    date = random.choice(all_dates)

    # 지정근무 간호사는 스왑 불가
    if n1 in dedicated_ids or n2 in dedicated_ids:
        return neighbor
    # AN끼리만 스왑 허용
    if (n1 in an_ids) != (n2 in an_ids):
        return neighbor

    s1 = neighbor.get(n1, {}).get(date)
    s2 = neighbor.get(n2, {}).get(date)
    if s1 and s2:
        # 스왑 후 허용 근무 검사
        if s2 in allowed_shifts(n1) and s1 in allowed_shifts(n2):
            neighbor[n1][date], neighbor[n2][date] = s2, s1

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
    v1.2: PN 제외, AN 분리, HN Day전담, 지정근무 일반화
    Returns: {"entries": [...], "score": float, "violations": [...]}
    """
    if not nurses:
        return {"entries": [], "score": 0, "violations": []}

    if prev_entries is None:
        prev_entries = []

    all_dates = _days_in_month(year_month)

    # PN 간호사 분리: 고정 요청만 반영, 나머지 전부 O
    pn_nurses = [n for n in nurses if n.get("grade") == "PN"]
    pn_schedule: Dict[int, Dict[str, str]] = {}
    for nurse in pn_nurses:
        nid = nurse["id"]
        pn_schedule[nid] = {d: "O" for d in all_dates}
        for req in approved_requests:
            if req["nurse_id"] == nid:
                pn_schedule[nid][req["date"]] = req["requested_shift_type"]

    # AN 간호사 분리
    an_nurses = [n for n in nurses if n.get("grade") == "AN" and n.get("grade") != "PN"]
    # Phase A 대상: HN/CN/RN (PN, AN 제외)
    phase_a_nurses = [n for n in nurses if n.get("grade") not in ("AN", "PN")]

    # Phase A: HN/CN/RN 스케줄 생성
    current_a = _create_initial_solution_phase_a(
        phase_a_nurses, rule, year_month, holidays, approved_requests, leave_map
    )

    # Phase B: AN 스케줄 생성
    an_approved = [r for r in approved_requests if r["nurse_id"] in {n["id"] for n in an_nurses}]
    current_b = _create_initial_solution_phase_b(
        an_nurses, rule, year_month, holidays, an_approved, leave_map
    )

    def merge_schedules(sched_a, sched_b, sched_pn):
        merged = {}
        merged.update(sched_a)
        merged.update(sched_b)
        merged.update(sched_pn)
        return merged

    nurse_dicts = nurses

    def evaluate(sol: Dict) -> Tuple[float, List[Dict]]:
        entries = [
            {"nurse_id": nid, "date": date, "shift_type": st}
            for nid, shifts in sol.items()
            for date, st in shifts.items()
        ]
        result = validate_schedule(entries, nurse_dicts, rule, year_month, holidays)
        return result["total_score"], result["violations"]

    # Phase A SA 최적화
    current = merge_schedules(current_a, current_b, pn_schedule)
    current_score, current_violations = evaluate(current)
    best = deepcopy(current)
    best_score = current_score
    best_violations = current_violations

    # SA에서 PN/AN 제외 (최적화 대상은 Phase A 간호사만)
    sa_nurses = phase_a_nurses  # AN은 Phase B에서 이미 결정

    temperature = INITIAL_TEMPERATURE
    no_improve = 0

    for iteration in range(MAX_ITERATIONS):
        # Phase A 부분만 이웃해 생성
        neighbor_a = _generate_neighbor(
            {nid: current[nid] for nid in current_a},
            sa_nurses, rule, year_month, holidays, current_violations
        )
        neighbor = merge_schedules(neighbor_a, current_b, pn_schedule)
        n_score, n_violations = evaluate(neighbor)

        delta = n_score - current_score
        if delta < 0 or (temperature > 0.01 and random.random() < math.exp(-delta / temperature)):
            current = neighbor
            current_a = {nid: current[nid] for nid in current_a}
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
