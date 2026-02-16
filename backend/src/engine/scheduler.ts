import { DEFAULT_CONSTRAINT_WEIGHTS, DEFAULT_SA_CONFIG } from '@nursesch/shared';
import type { ConstraintWeights } from '@nursesch/shared';
import type { ScheduleInput, ScheduleResult, Solution, ScheduleRule } from './types.js';
import { validateSchedule } from './validator.js';

// ===== Simulated Annealing 기반 근무표 자동 생성 엔진 =====
// designreq.md 7장 알고리즘 설계 요구사항 기반 구현
// PDF: SA 파라미터, 재가열 메커니즘, 위반 대상 지향적 이웃 해 생성

const SHIFT_TYPES = ['D', 'E', 'N', 'O'] as const;
const WORK_SHIFTS = ['D', 'E', 'N'] as const;

/** 해당 월의 모든 날짜 생성 */
function getDatesInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function isWeekendOrHoliday(dateStr: string, holidays: string[]): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6 || holidays.includes(dateStr);
}

/** Solution을 깊은 복사 */
function copySolution(solution: Solution): Solution {
  const copy: Solution = new Map();
  for (const [nurseId, dateMap] of solution) {
    copy.set(nurseId, new Map(dateMap));
  }
  return copy;
}

/** Solution을 entries 배열로 변환 */
function solutionToEntries(solution: Solution): { nurseId: number; date: string; shiftType: string }[] {
  const entries: { nurseId: number; date: string; shiftType: string }[] = [];
  for (const [nurseId, dateMap] of solution) {
    for (const [date, shiftType] of dateMap) {
      entries.push({ nurseId, date, shiftType });
    }
  }
  return entries;
}

/** 평가 함수: Solution의 총 점수 계산 (낮을수록 좋음) */
function evaluateSolution(
  solution: Solution,
  input: ScheduleInput,
): number {
  const entries = solutionToEntries(solution);
  const result = validateSchedule(
    entries,
    input.nurses,
    input.rule,
    input.yearMonth,
    input.holidays,
    input.shiftRequests,
  );
  return result.totalScore;
}

/**
 * 초기 해 생성 (designreq.md 7.4)
 * 이전 달 근무표 기반 + 최소 인원 요구사항 충족 시도
 */
function createInitialSolution(input: ScheduleInput): Solution {
  const solution: Solution = new Map();
  const dates = getDatesInMonth(input.yearMonth);
  const { nurses, rule, holidays, shiftRequests, prevMonthEntries } = input;

  for (const nurse of nurses) {
    solution.set(nurse.id, new Map());
  }

  // 이전 달 마지막 며칠 근무 기록 (연속성 참조용)
  const prevLastShifts = new Map<number, string[]>();
  if (prevMonthEntries.length > 0) {
    for (const nurse of nurses) {
      const nurseEntries = prevMonthEntries
        .filter(e => e.nurseId === nurse.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      prevLastShifts.set(nurse.id, nurseEntries.slice(-5).map(e => e.shiftType));
    }
  }

  // 승인된 요청 먼저 배치
  const requestMap = new Map<string, string>(); // "nurseId-date" -> shiftType
  for (const req of shiftRequests) {
    requestMap.set(`${req.nurseId}-${req.date}`, req.requestedShiftType);
  }

  // 각 날짜별로 최소 인원 요구사항을 맞추며 배정
  for (const date of dates) {
    const isWE = isWeekendOrHoliday(date, holidays);
    const required = {
      D: isWE ? rule.weekendDayCount : rule.weekdayDayCount,
      E: isWE ? rule.weekendEveningCount : rule.weekdayEveningCount,
      N: isWE ? rule.weekendNightCount : rule.weekdayNightCount,
    };

    // 요청이 있는 간호사 먼저 배정
    const assigned = new Set<number>();
    const shiftCounts = { D: 0, E: 0, N: 0 };

    for (const nurse of nurses) {
      const key = `${nurse.id}-${date}`;
      if (requestMap.has(key)) {
        const shift = requestMap.get(key)!;
        solution.get(nurse.id)!.set(date, shift);
        assigned.add(nurse.id);
        if (shift in shiftCounts) shiftCounts[shift as keyof typeof shiftCounts]++;
      }
    }

    // 미배정 간호사들을 셔플하여 배정
    const unassigned = nurses.filter(n => !assigned.has(n.id));
    shuffleArray(unassigned);

    // 각 근무 유형의 부족분 채우기
    for (const shiftType of WORK_SHIFTS) {
      while (shiftCounts[shiftType] < required[shiftType] && unassigned.length > 0) {
        const nurse = unassigned.shift()!;
        solution.get(nurse.id)!.set(date, shiftType);
        assigned.add(nurse.id);
        shiftCounts[shiftType]++;
      }
    }

    // 나머지 간호사는 휴무(O) 배정
    for (const nurse of unassigned) {
      solution.get(nurse.id)!.set(date, 'O');
      assigned.add(nurse.id);
    }
  }

  return solution;
}

/**
 * 이웃 해 생성 (designreq.md 7.5)
 * 위반 대상 지향적(violation-targeted) 변형:
 * - 현재 해에서 하드 제약 위반을 찾아 해소하는 방향으로 변형
 * - 또는 무작위 스왑으로 탐색 공간 확장
 */
function generateNeighborSolution(
  current: Solution,
  input: ScheduleInput,
): Solution {
  const neighbor = copySolution(current);
  const dates = getDatesInMonth(input.yearMonth);
  const nurseIds = input.nurses.map(n => n.id);

  // 50% 확률로 위반 대상 지향적 변형 vs 무작위 스왑
  if (Math.random() < 0.5) {
    // 위반 대상 지향적: 제약 위반을 찾아서 수정
    const entries = solutionToEntries(neighbor);
    const validation = validateSchedule(
      entries, input.nurses, input.rule, input.yearMonth, input.holidays, input.shiftRequests,
    );

    const hardViolations = validation.violations.filter(v => v.type === 'HARD');
    if (hardViolations.length > 0) {
      const violation = hardViolations[Math.floor(Math.random() * hardViolations.length)];
      resolveViolation(neighbor, violation, input, dates, nurseIds);
      return neighbor;
    }
  }

  // 무작위 스왑: 같은 날짜의 두 간호사 근무를 교환
  const randomDate = dates[Math.floor(Math.random() * dates.length)];
  const n1 = nurseIds[Math.floor(Math.random() * nurseIds.length)];
  let n2 = nurseIds[Math.floor(Math.random() * nurseIds.length)];
  while (n2 === n1 && nurseIds.length > 1) {
    n2 = nurseIds[Math.floor(Math.random() * nurseIds.length)];
  }

  const shift1 = neighbor.get(n1)!.get(randomDate) || 'O';
  const shift2 = neighbor.get(n2)!.get(randomDate) || 'O';
  neighbor.get(n1)!.set(randomDate, shift2);
  neighbor.get(n2)!.set(randomDate, shift1);

  return neighbor;
}

/** 특정 위반을 해소하는 방향으로 해를 수정 */
function resolveViolation(
  solution: Solution,
  violation: { ruleId: string; nurseId?: number; date?: string },
  input: ScheduleInput,
  dates: string[],
  nurseIds: number[],
): void {
  const { rule, holidays } = input;

  switch (violation.ruleId) {
    case 'HC-1': {
      // 인원 부족: 해당 날짜에서 O인 간호사를 부족한 근무 유형으로 변경
      if (!violation.date) break;
      const date = violation.date;
      const isWE = isWeekendOrHoliday(date, holidays);

      for (const shiftType of WORK_SHIFTS) {
        const required = shiftType === 'D'
          ? (isWE ? rule.weekendDayCount : rule.weekdayDayCount)
          : shiftType === 'E'
            ? (isWE ? rule.weekendEveningCount : rule.weekdayEveningCount)
            : (isWE ? rule.weekendNightCount : rule.weekdayNightCount);

        const current = nurseIds.filter(id => solution.get(id)!.get(date) === shiftType).length;
        if (current < required) {
          // O인 간호사 중 하나를 해당 근무로 변경
          const offNurses = nurseIds.filter(id => solution.get(id)!.get(date) === 'O');
          if (offNurses.length > 0) {
            const picked = offNurses[Math.floor(Math.random() * offNurses.length)];
            solution.get(picked)!.set(date, shiftType);
          }
          break;
        }
      }
      break;
    }
    case 'HC-2': {
      // 연속 근무 초과: 해당 간호사의 연속 근무 중 하나를 O로 변경
      if (!violation.nurseId) break;
      const nurseMap = solution.get(violation.nurseId)!;
      // 연속 근무 구간에서 랜덤 날짜를 O로 바꾸고, 다른 O인 간호사와 스왑
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      const currentShift = nurseMap.get(randomDate);
      if (currentShift && currentShift !== 'O' && currentShift !== 'X') {
        // 같은 날 O인 다른 간호사와 교환
        const offNurse = nurseIds.find(id =>
          id !== violation.nurseId && solution.get(id)!.get(randomDate) === 'O'
        );
        if (offNurse) {
          solution.get(offNurse)!.set(randomDate, currentShift);
          nurseMap.set(randomDate, 'O');
        }
      }
      break;
    }
    case 'HC-3': {
      // 금지 전환 패턴: 해당 간호사의 문제 날짜 근무 변경
      if (!violation.nurseId || !violation.date) break;
      const nurseMap = solution.get(violation.nurseId)!;
      const dateIdx = dates.indexOf(violation.date);
      if (dateIdx >= 0 && dateIdx < dates.length - 1) {
        const nextDate = dates[dateIdx + 1];
        const nextShift = nurseMap.get(nextDate);
        // N 다음날의 근무를 O로 변경하고 다른 간호사와 스왑
        if (nextShift && nextShift !== 'O') {
          const offNurse = nurseIds.find(id =>
            id !== violation.nurseId && solution.get(id)!.get(nextDate) === 'O'
          );
          if (offNurse) {
            solution.get(offNurse)!.set(nextDate, nextShift);
            nurseMap.set(nextDate, 'O');
          }
        }
      }
      break;
    }
    case 'HC-4': {
      // 나이트 보호: 단독 N → 연속 N으로 만들거나, 4+ 연속 N → 하나를 O로
      if (!violation.nurseId) break;
      const nurseMap = solution.get(violation.nurseId)!;
      const shifts = dates.map(d => nurseMap.get(d) || 'O');

      // 연속 나이트 블록 찾기
      let start = -1;
      for (let i = 0; i < shifts.length; i++) {
        if (shifts[i] === 'N') {
          if (start === -1) start = i;
        } else if (start !== -1) {
          const len = i - start;
          if (len === 1) {
            // 단독 N: 다음 날도 N으로 만들기 (스왑)
            if (i < shifts.length) {
              const swapTarget = nurseIds.find(id =>
                id !== violation.nurseId && solution.get(id)!.get(dates[i]) === 'N'
              );
              if (swapTarget) {
                const myShift = nurseMap.get(dates[i])!;
                nurseMap.set(dates[i], 'N');
                solution.get(swapTarget)!.set(dates[i], myShift);
              }
            }
          } else if (len >= 4) {
            // 4+ 연속: 마지막 N을 O로 변경
            const lastNDate = dates[i - 1];
            const offNurse = nurseIds.find(id =>
              id !== violation.nurseId && solution.get(id)!.get(lastNDate) === 'O'
            );
            if (offNurse) {
              solution.get(offNurse)!.set(lastNDate, 'N');
              nurseMap.set(lastNDate, 'O');
            }
          }
          start = -1;
        }
      }
      break;
    }
  }
}

/** 배열 셔플 (Fisher-Yates) */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * SA 해 수락 기준 (designreq.md 7.7)
 * 더 좋은 해는 항상 수락, 나쁜 해는 확률적 수락
 */
function acceptSolution(currentScore: number, neighborScore: number, temperature: number): boolean {
  if (neighborScore <= currentScore) return true;
  const delta = neighborScore - currentScore;
  const probability = Math.exp(-delta / temperature);
  return Math.random() < probability;
}

/**
 * 근무표 자동 생성 메인 함수
 * designreq.md 7.8 SA 메인 루프 구현
 */
export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const config = DEFAULT_SA_CONFIG;

  // Phase 1: 초기 해 생성 (7.4)
  let currentSolution = createInitialSolution(input);
  let bestSolution = copySolution(currentSolution);
  let currentScore = evaluateSolution(currentSolution, input);
  let bestScore = currentScore;
  let temperature = config.initialTemperature;
  let noImprovementCount = 0;

  // SA 메인 루프 (7.8)
  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    // 이웃 해 생성 (7.5)
    const neighborSolution = generateNeighborSolution(currentSolution, input);
    const neighborScore = evaluateSolution(neighborSolution, input);

    // 해 수락 기준 (7.7)
    if (acceptSolution(currentScore, neighborScore, temperature)) {
      currentSolution = neighborSolution;
      currentScore = neighborScore;

      if (currentScore < bestScore) {
        bestSolution = copySolution(currentSolution);
        bestScore = currentScore;
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }
    } else {
      noImprovementCount++;
    }

    // 냉각
    temperature *= config.coolingRate;

    // 재가열 메커니즘 (7.2): 개선 없으면 온도 리셋
    if (noImprovementCount > config.maxNoImprovement) {
      temperature = config.initialTemperature;
      noImprovementCount = 0;
    }

    // 최적해(하드 제약 위반 0)이면 조기 종료
    if (bestScore <= 0) break;
  }

  // 결과 변환
  const entries = solutionToEntries(bestSolution);
  const validation = validateSchedule(
    entries, input.nurses, input.rule, input.yearMonth, input.holidays, input.shiftRequests,
  );

  return {
    entries,
    score: bestScore,
    violations: validation.violations,
  };
}
