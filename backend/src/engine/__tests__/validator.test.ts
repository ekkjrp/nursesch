import { describe, it, expect } from 'vitest';
import { validateSchedule } from '../validator.js';

// designreq.md 11.1 단위 테스트 + 11.4 알고리즘 검증 테스트

const yearMonth = '2026-03';
const nurses = [
  { id: 1, name: '간호사A', skillLevel: 'CHARGE' },
  { id: 2, name: '간호사B', skillLevel: 'SENIOR' },
  { id: 3, name: '간호사C', skillLevel: 'SENIOR' },
  { id: 4, name: '간호사D', skillLevel: 'JUNIOR' },
  { id: 5, name: '간호사E', skillLevel: 'SENIOR' },
  { id: 6, name: '간호사F', skillLevel: 'JUNIOR' },
  { id: 7, name: '간호사G', skillLevel: 'SENIOR' },
  { id: 8, name: '간호사H', skillLevel: 'JUNIOR' },
  { id: 9, name: '간호사I', skillLevel: 'CHARGE' },
  { id: 10, name: '간호사J', skillLevel: 'SENIOR' },
];

const defaultRule = {
  maxConsecutiveWorkDays: 5,
  maxConsecutiveNightShifts: 3,
  minMonthlyOffDays: 8,
  weekdayDayCount: 3,
  weekdayEveningCount: 2,
  weekdayNightCount: 2,
  weekendDayCount: 2,
  weekendEveningCount: 2,
  weekendNightCount: 2,
  allowNightToDay: false,
  allowNightToEvening: false,
  allowNightOffDay: false,
  constraintWeights: {},
};

// 특정 날짜에 간호사별 근무를 지정하는 헬퍼
function makeEntries(dateShifts: Record<string, Record<number, string>>): any[] {
  const entries: any[] = [];
  for (const [date, nurseShifts] of Object.entries(dateShifts)) {
    for (const [nurseId, shiftType] of Object.entries(nurseShifts)) {
      entries.push({ nurseId: Number(nurseId), date, shiftType });
    }
  }
  return entries;
}

describe('HC-1: 근무 유형별 최소 인원 충족', () => {
  it('인원이 충족되면 위반 없음', () => {
    // 2026-03-02는 월요일(평일)
    const entries = makeEntries({
      '2026-03-02': { 1: 'D', 2: 'D', 3: 'D', 4: 'E', 5: 'E', 6: 'N', 7: 'N', 8: 'O', 9: 'O', 10: 'O' },
    });
    const result = validateSchedule(entries, nurses.slice(0, 10), defaultRule, yearMonth);
    const hc1Violations = result.violations.filter(v => v.ruleId === 'HC-1' && v.date === '2026-03-02');
    expect(hc1Violations.length).toBe(0);
  });

  it('인원 부족 시 위반 감지', () => {
    // D=1명 (최소 3명 필요)
    const entries = makeEntries({
      '2026-03-02': { 1: 'D', 2: 'O', 3: 'O', 4: 'E', 5: 'E', 6: 'N', 7: 'N', 8: 'O', 9: 'O', 10: 'O' },
    });
    const result = validateSchedule(entries, nurses.slice(0, 10), defaultRule, yearMonth);
    const hc1Violations = result.violations.filter(v => v.ruleId === 'HC-1' && v.date === '2026-03-02');
    expect(hc1Violations.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });
});

describe('HC-2: 최대 연속 근무일 제한', () => {
  it('5일 연속은 허용', () => {
    const entries: any[] = [];
    // 간호사1: 3/2~3/6 (5일 연속 D)
    for (let d = 2; d <= 6; d++) {
      entries.push({ nurseId: 1, date: `2026-03-${String(d).padStart(2, '0')}`, shiftType: 'D' });
    }
    entries.push({ nurseId: 1, date: '2026-03-07', shiftType: 'O' });

    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc2 = result.violations.filter(v => v.ruleId === 'HC-2');
    expect(hc2.length).toBe(0);
  });

  it('6일 연속 시 위반 감지', () => {
    const entries: any[] = [];
    // 간호사1: 3/2~3/7 (6일 연속)
    for (let d = 2; d <= 7; d++) {
      entries.push({ nurseId: 1, date: `2026-03-${String(d).padStart(2, '0')}`, shiftType: 'D' });
    }

    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc2 = result.violations.filter(v => v.ruleId === 'HC-2');
    expect(hc2.length).toBeGreaterThan(0);
  });
});

describe('HC-3: 금지 전환 패턴', () => {
  it('N→D 패턴 위반 감지', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'D' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc3 = result.violations.filter(v => v.ruleId === 'HC-3');
    expect(hc3.length).toBeGreaterThan(0);
  });

  it('N→E 패턴 위반 감지', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'E' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc3 = result.violations.filter(v => v.ruleId === 'HC-3');
    expect(hc3.length).toBeGreaterThan(0);
  });

  it('NOD 패턴 위반 감지', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'O' },
      { nurseId: 1, date: '2026-03-04', shiftType: 'D' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc3 = result.violations.filter(v => v.ruleId === 'HC-3');
    expect(hc3.length).toBeGreaterThan(0);
  });

  it('N→O→E는 허용 (NOD만 금지)', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'O' },
      { nurseId: 1, date: '2026-03-04', shiftType: 'E' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc3 = result.violations.filter(v => v.ruleId === 'HC-3');
    // N→E on non-consecutive days is OK; only N→O→D is forbidden
    expect(hc3.length).toBe(0);
  });

  it('allowNightToDay=true이면 N→D 허용', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'D' },
    ];
    const rule = { ...defaultRule, allowNightToDay: true };
    const result = validateSchedule(entries, [nurses[0]], rule, yearMonth);
    const hc3 = result.violations.filter(v => v.ruleId === 'HC-3');
    expect(hc3.length).toBe(0);
  });
});

describe('HC-4: 나이트 근무 보호', () => {
  it('나이트 단독(1일만 N) 감지', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'O' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-04', shiftType: 'O' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc4 = result.violations.filter(v => v.ruleId === 'HC-4');
    expect(hc4.length).toBeGreaterThan(0);
  });

  it('나이트 2~3일 연속은 허용', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-04', shiftType: 'O' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc4 = result.violations.filter(v => v.ruleId === 'HC-4');
    expect(hc4.length).toBe(0);
  });

  it('나이트 4일 연속 위반 감지', () => {
    const entries = [
      { nurseId: 1, date: '2026-03-02', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-03', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-04', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-05', shiftType: 'N' },
      { nurseId: 1, date: '2026-03-06', shiftType: 'O' },
    ];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const hc4 = result.violations.filter(v => v.ruleId === 'HC-4');
    expect(hc4.length).toBeGreaterThan(0);
  });
});

describe('SC-1: 개인 근무 요청 반영', () => {
  it('요청이 반영되면 페널티 없음', () => {
    const entries = [{ nurseId: 1, date: '2026-03-10', shiftType: 'O' }];
    const requests = [{ nurseId: 1, date: '2026-03-10', requestedShiftType: 'O' }];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth, [], requests);
    const sc1 = result.violations.filter(v => v.ruleId === 'SC-1');
    expect(sc1.length).toBe(0);
  });

  it('요청 미반영 시 소프트 페널티', () => {
    const entries = [{ nurseId: 1, date: '2026-03-10', shiftType: 'D' }];
    const requests = [{ nurseId: 1, date: '2026-03-10', requestedShiftType: 'O' }];
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth, [], requests);
    const sc1 = result.violations.filter(v => v.ruleId === 'SC-1');
    expect(sc1.length).toBe(1);
    expect(sc1[0].type).toBe('SOFT');
  });
});

describe('SC-3: 휴무일 연속 배치 보너스', () => {
  it('연속 휴무 시 음수(보너스) 페널티', () => {
    const entries: any[] = [];
    // 모든 날 O 배정 → 연속 휴무 보너스 발생
    for (let d = 1; d <= 31; d++) {
      entries.push({ nurseId: 1, date: `2026-03-${String(d).padStart(2, '0')}`, shiftType: 'O' });
    }
    const result = validateSchedule(entries, [nurses[0]], defaultRule, yearMonth);
    const sc3 = result.violations.filter(v => v.ruleId === 'SC-3');
    expect(sc3.length).toBe(1);
    expect(sc3[0].penalty).toBeLessThan(0); // 보너스 = 음수 페널티
  });
});
