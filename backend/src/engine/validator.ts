import { DEFAULT_CONSTRAINT_WEIGHTS } from '@nursesch/shared';
import type { ConstraintWeights } from '@nursesch/shared';

// ===== Constraint Validator =====
// Scheduling Engine과 분리된 독립 모듈 (CLAUDE.md 아키텍처 요구사항)
// designreq.md 8장 제약 조건 상세 명세 기반

interface Violation {
  type: 'HARD' | 'SOFT';
  ruleId: string;
  message: string;
  nurseId?: number;
  date?: string;
  penalty: number;
}

interface ValidationResult {
  isValid: boolean;
  totalScore: number;
  violations: Violation[];
}

interface EntryLike {
  nurseId: number;
  date: string;
  shiftType: string;
}

interface NurseLike {
  id: number;
  name: string;
  skillLevel: string;
}

interface RuleLike {
  maxConsecutiveWorkDays: number;
  maxConsecutiveNightShifts: number;
  minMonthlyOffDays: number;
  weekdayDayCount: number;
  weekdayEveningCount: number;
  weekdayNightCount: number;
  weekendDayCount: number;
  weekendEveningCount: number;
  weekendNightCount: number;
  allowNightToDay: boolean;
  allowNightToEvening: boolean;
  allowNightOffDay: boolean;
  constraintWeights: Partial<ConstraintWeights>;
}

// 날짜가 주말/공휴일인지 확인
function isWeekendOrHoliday(dateStr: string, holidays: string[]): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6 || holidays.includes(dateStr);
}

// 해당 월의 모든 날짜 생성
function getDatesInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

/**
 * 근무표 전체 검증
 * 하드 제약 위반 시 isValid=false, 소프트 제약 위반 시 페널티 누적
 */
export function validateSchedule(
  entries: EntryLike[],
  nurses: NurseLike[],
  rule: RuleLike,
  yearMonth: string,
  holidays: string[] = [],
  shiftRequests: { nurseId: number; date: string; requestedShiftType: string }[] = [],
): ValidationResult {
  const weights = { ...DEFAULT_CONSTRAINT_WEIGHTS, ...rule.constraintWeights };
  const violations: Violation[] = [];
  const dates = getDatesInMonth(yearMonth);

  // 간호사별 엔트리 맵
  const nurseEntryMap = new Map<number, Map<string, string>>();
  for (const nurse of nurses) {
    nurseEntryMap.set(nurse.id, new Map());
  }
  for (const entry of entries) {
    const map = nurseEntryMap.get(entry.nurseId);
    if (map) map.set(entry.date, entry.shiftType);
  }

  // === HC-1: 근무 유형별 최소 인원 충족 ===
  for (const date of dates) {
    const isWE = isWeekendOrHoliday(date, holidays);
    const dayCount = isWE ? rule.weekendDayCount : rule.weekdayDayCount;
    const eveningCount = isWE ? rule.weekendEveningCount : rule.weekdayEveningCount;
    const nightCount = isWE ? rule.weekendNightCount : rule.weekdayNightCount;

    const dateEntries = entries.filter(e => e.date === date);
    const actualD = dateEntries.filter(e => e.shiftType === 'D').length;
    const actualE = dateEntries.filter(e => e.shiftType === 'E').length;
    const actualN = dateEntries.filter(e => e.shiftType === 'N').length;

    if (actualD < dayCount) {
      violations.push({
        type: 'HARD', ruleId: 'HC-1', date,
        message: `${date} 낮번(D) 인원 부족: ${actualD}/${dayCount}명`,
        penalty: (dayCount - actualD) * weights.shiftRequirements,
      });
    }
    if (actualE < eveningCount) {
      violations.push({
        type: 'HARD', ruleId: 'HC-1', date,
        message: `${date} 저녁번(E) 인원 부족: ${actualE}/${eveningCount}명`,
        penalty: (eveningCount - actualE) * weights.shiftRequirements,
      });
    }
    if (actualN < nightCount) {
      violations.push({
        type: 'HARD', ruleId: 'HC-1', date,
        message: `${date} 밤번(N) 인원 부족: ${actualN}/${nightCount}명`,
        penalty: (nightCount - actualN) * weights.shiftRequirements,
      });
    }
  }

  // === 간호사별 검증 ===
  for (const nurse of nurses) {
    const nurseMap = nurseEntryMap.get(nurse.id)!;
    const shifts = dates.map(d => nurseMap.get(d) || 'O');

    // HC-2: 최대 연속 근무일 제한
    let consecutive = 0;
    for (let i = 0; i < shifts.length; i++) {
      if (shifts[i] !== 'O' && shifts[i] !== 'X') {
        consecutive++;
        if (consecutive > rule.maxConsecutiveWorkDays) {
          violations.push({
            type: 'HARD', ruleId: 'HC-2', nurseId: nurse.id, date: dates[i],
            message: `${nurse.name}: ${consecutive}일 연속 근무 (최대 ${rule.maxConsecutiveWorkDays}일)`,
            penalty: weights.consecutiveWorkDays,
          });
        }
      } else {
        consecutive = 0;
      }
    }

    // HC-3: 금지 전환 패턴 (N→D, N→E, NOD)
    for (let i = 0; i < shifts.length - 1; i++) {
      // N→D 금지
      if (shifts[i] === 'N' && shifts[i + 1] === 'D' && !rule.allowNightToDay) {
        violations.push({
          type: 'HARD', ruleId: 'HC-3', nurseId: nurse.id, date: dates[i],
          message: `${nurse.name}: N→D 전환 금지 위반 (${dates[i]}~${dates[i + 1]})`,
          penalty: weights.forbiddenPatterns,
        });
      }
      // N→E 금지
      if (shifts[i] === 'N' && shifts[i + 1] === 'E' && !rule.allowNightToEvening) {
        violations.push({
          type: 'HARD', ruleId: 'HC-3', nurseId: nurse.id, date: dates[i],
          message: `${nurse.name}: N→E 전환 금지 위반 (${dates[i]}~${dates[i + 1]})`,
          penalty: weights.forbiddenPatterns,
        });
      }
    }
    // NOD 패턴 금지
    for (let i = 0; i < shifts.length - 2; i++) {
      if (shifts[i] === 'N' && shifts[i + 1] === 'O' && shifts[i + 2] === 'D' && !rule.allowNightOffDay) {
        violations.push({
          type: 'HARD', ruleId: 'HC-3', nurseId: nurse.id, date: dates[i],
          message: `${nurse.name}: NOD 패턴 금지 위반 (${dates[i]}~${dates[i + 2]})`,
          penalty: weights.forbiddenPatterns,
        });
      }
    }

    // HC-4: 나이트 근무 보호 (단독 N 금지, 연속 4일 이상 N 금지)
    let consecutiveN = 0;
    const nightBlocks: number[] = []; // 연속 나이트 블록 길이 기록
    for (let i = 0; i <= shifts.length; i++) {
      if (i < shifts.length && shifts[i] === 'N') {
        consecutiveN++;
      } else {
        if (consecutiveN > 0) nightBlocks.push(consecutiveN);
        consecutiveN = 0;
      }
    }
    for (const blockLen of nightBlocks) {
      // 나이트 단독(1일만) 금지
      if (blockLen === 1) {
        violations.push({
          type: 'HARD', ruleId: 'HC-4', nurseId: nurse.id,
          message: `${nurse.name}: 나이트 단독 근무 금지 위반`,
          penalty: weights.nightProtection,
        });
      }
      // 연속 4일 이상 나이트 금지
      if (blockLen >= 4) {
        violations.push({
          type: 'HARD', ruleId: 'HC-4', nurseId: nurse.id,
          message: `${nurse.name}: ${blockLen}일 연속 나이트 (최대 3일)`,
          penalty: (blockLen - 3) * weights.nightProtection,
        });
      }
    }

    // SC-1: 개인 근무 요청 반영
    const nurseRequests = shiftRequests.filter(r => r.nurseId === nurse.id);
    for (const req of nurseRequests) {
      const actual = nurseMap.get(req.date);
      if (actual && actual !== req.requestedShiftType) {
        violations.push({
          type: 'SOFT', ruleId: 'SC-1', nurseId: nurse.id, date: req.date,
          message: `${nurse.name}: ${req.date} 요청(${req.requestedShiftType}) 미반영 (실제: ${actual})`,
          penalty: weights.shiftRequests,
        });
      }
    }

    // SC-2c: 연속 야간 근무 최소화 (3일 연속은 허용하되 페널티)
    for (const blockLen of nightBlocks) {
      if (blockLen >= 3) {
        violations.push({
          type: 'SOFT', ruleId: 'SC-2c', nurseId: nurse.id,
          message: `${nurse.name}: ${blockLen}일 연속 야간 근무`,
          penalty: weights.consecutiveNightMin,
        });
      }
    }

    // SC-3: 휴무일 연속 배치 보너스 (점수 감점 = 보너스)
    let consecutiveOff = 0;
    let offBonus = 0;
    for (const s of shifts) {
      if (s === 'O') {
        consecutiveOff++;
        if (consecutiveOff >= 2) offBonus += weights.offDayClustering;
      } else {
        consecutiveOff = 0;
      }
    }
    if (offBonus > 0) {
      violations.push({
        type: 'SOFT', ruleId: 'SC-3', nurseId: nurse.id,
        message: `${nurse.name}: 연속 휴무 보너스 -${offBonus}점`,
        penalty: -offBonus,
      });
    }
  }

  // SC-2: 균등한 업무 유형 배분
  const nurseCounts = nurses.map(nurse => {
    const map = nurseEntryMap.get(nurse.id)!;
    const counts = { D: 0, E: 0, N: 0, O: 0, weekendWork: 0 };
    for (const date of dates) {
      const shift = map.get(date) || 'O';
      if (shift === 'D') counts.D++;
      else if (shift === 'E') counts.E++;
      else if (shift === 'N') counts.N++;
      else counts.O++;

      if (isWeekendOrHoliday(date, holidays) && shift !== 'O' && shift !== 'X') {
        counts.weekendWork++;
      }
    }
    return { nurseId: nurse.id, name: nurse.name, ...counts };
  });

  if (nurseCounts.length > 1) {
    // D/E/N 각각의 표준편차 기반 페널티
    for (const shiftType of ['D', 'E', 'N'] as const) {
      const values = nurseCounts.map(c => c[shiftType]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / values.length;
      const stddev = Math.sqrt(variance);
      if (stddev > 1) {
        violations.push({
          type: 'SOFT', ruleId: 'SC-2',
          message: `${shiftType}번 배분 불균등 (표준편차: ${stddev.toFixed(1)})`,
          penalty: stddev * weights.workloadBalance,
        });
      }
    }

    // SC-2a: 주말 근무 균등
    const weekendValues = nurseCounts.map(c => c.weekendWork);
    const weekendAvg = weekendValues.reduce((a, b) => a + b, 0) / weekendValues.length;
    const weekendVar = weekendValues.reduce((a, v) => a + Math.pow(v - weekendAvg, 2), 0) / weekendValues.length;
    const weekendStd = Math.sqrt(weekendVar);
    if (weekendStd > 1) {
      violations.push({
        type: 'SOFT', ruleId: 'SC-2a',
        message: `주말 근무 배분 불균등 (표준편차: ${weekendStd.toFixed(1)})`,
        penalty: weekendStd * weights.weekendBalance,
      });
    }
  }

  // SC-2b: 숙련도별 조 구성 (각 날짜의 각 근무조에 다양한 숙련도 배치)
  for (const date of dates) {
    for (const shiftType of ['D', 'E', 'N'] as const) {
      const assignedNurses = entries
        .filter(e => e.date === date && e.shiftType === shiftType)
        .map(e => nurses.find(n => n.id === e.nurseId))
        .filter(Boolean);

      if (assignedNurses.length >= 2) {
        const skills = new Set(assignedNurses.map(n => n!.skillLevel));
        if (skills.size === 1) {
          violations.push({
            type: 'SOFT', ruleId: 'SC-2b', date,
            message: `${date} ${shiftType}번: 동일 숙련도만 배치됨`,
            penalty: weights.skillMix,
          });
        }
      }
    }
  }

  const totalScore = violations.reduce((sum, v) => sum + v.penalty, 0);
  const hasHardViolation = violations.some(v => v.type === 'HARD');

  return {
    isValid: !hasHardViolation,
    totalScore,
    violations,
  };
}
