import type { ConstraintWeights, DEFAULT_CONSTRAINT_WEIGHTS } from '@nursesch/shared';

// 스케줄링 엔진 내부 타입

export interface ScheduleNurse {
  id: number;
  name: string;
  skillLevel: string;
}

export interface ScheduleRule {
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

export interface ScheduleRequest {
  nurseId: number;
  date: string;
  requestedShiftType: string;
}

export interface ScheduleInput {
  nurses: ScheduleNurse[];
  rule: ScheduleRule;
  yearMonth: string;
  holidays: string[];
  shiftRequests: ScheduleRequest[];
  prevMonthEntries: { nurseId: number; date: string; shiftType: string }[];
}

export interface ScheduleResult {
  entries: { nurseId: number; date: string; shiftType: string }[];
  score: number;
  violations: { type: string; ruleId: string; message: string; nurseId?: number; date?: string; penalty: number }[];
}

// Solution: nurseId -> date -> shiftType 매핑
export type Solution = Map<number, Map<string, string>>;
