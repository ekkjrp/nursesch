// ===== 근무 유형 (Shift Types) =====
export type ShiftType = 'D' | 'E' | 'N' | 'O' | 'X';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  D: '낮번 (Day)',
  E: '저녁번 (Evening)',
  N: '밤번 (Night)',
  O: '휴무 (Off)',
  X: '기타',
};

// UI 색상 코딩 (designreq.md 4.1)
export const SHIFT_COLORS: Record<ShiftType, string> = {
  D: '#4A90D9',
  E: '#7BC67E',
  N: '#9B59B6',
  O: '#BDC3C7',
  X: '#F1C40F',
};

// ===== 사용자 역할 =====
export type UserRole = 'ADMIN' | 'NURSE';

// ===== 숙련도 등급 =====
export type SkillLevel = 'JUNIOR' | 'SENIOR' | 'CHARGE';

// ===== 근무표 상태 =====
export type ScheduleStatus = 'DRAFT' | 'CONFIRMED';

// ===== 근무 요청 상태 =====
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ===== 엔티티 인터페이스 =====

export interface Ward {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Nurse {
  id: number;
  wardId: number;
  name: string;
  email: string;
  role: UserRole;
  skillLevel: SkillLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Rule {
  id: number;
  wardId: number;
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
  constraintWeights: ConstraintWeights;
}

export interface Schedule {
  id: number;
  wardId: number;
  yearMonth: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
  entries?: ScheduleEntry[];
}

export interface ScheduleEntry {
  id: number;
  scheduleId: number;
  nurseId: number;
  date: string;
  shiftType: ShiftType;
  isManuallyEdited: boolean;
}

export interface ShiftRequest {
  id: number;
  nurseId: number;
  scheduleId: number;
  date: string;
  requestedShiftType: ShiftType;
  status: RequestStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: number;
  wardId: number;
  date: string;
  name: string;
  type: 'HOLIDAY' | 'EDUCATION' | 'OTHER';
}

// ===== 제약 조건 가중치 (designreq.md 8.3) =====
export interface ConstraintWeights {
  // 하드 제약 — 기본 1000점 이상
  shiftRequirements: number;     // HC-1: 근무 유형별 최소 인원
  consecutiveWorkDays: number;   // HC-2: 최대 연속 근무일
  forbiddenPatterns: number;     // HC-3: 금지 전환 패턴
  nightProtection: number;       // HC-4: 나이트 근무 보호

  // 소프트 제약
  shiftRequests: number;         // SC-1: 개인 근무 요청 (중간: 30)
  workloadBalance: number;       // SC-2: 균등 배분 (높음: 70)
  weekendBalance: number;        // SC-2a: 주말 균등 (높음: 60)
  skillMix: number;              // SC-2b: 숙련도별 조 구성 (중간: 30)
  consecutiveNightMin: number;   // SC-2c: 연속 야간 최소화 (중간: 40)
  offDayClustering: number;      // SC-3: 휴무 연속 배치 (낮음: 10)
}

export const DEFAULT_CONSTRAINT_WEIGHTS: ConstraintWeights = {
  shiftRequirements: 1000,
  consecutiveWorkDays: 1000,
  forbiddenPatterns: 1000,
  nightProtection: 1000,
  shiftRequests: 30,
  workloadBalance: 70,
  weekendBalance: 60,
  skillMix: 30,
  consecutiveNightMin: 40,
  offDayClustering: 10,
};

// ===== API 요청/응답 타입 =====

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  nurse: Nurse;
}

export interface GenerateScheduleRequest {
  wardId: number;
  yearMonth: string;
}

export interface ConstraintViolation {
  type: 'HARD' | 'SOFT';
  ruleId: string;
  message: string;
  nurseId?: number;
  date?: string;
  penalty: number;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  totalScore: number;
  violations: ConstraintViolation[];
}

// ===== SA 알고리즘 설정 =====
export interface SAConfig {
  initialTemperature: number;
  coolingRate: number;
  maxIterations: number;
  maxNoImprovement: number;
}

export const DEFAULT_SA_CONFIG: SAConfig = {
  initialTemperature: 1000,
  coolingRate: 0.9993,
  maxIterations: 15000,
  maxNoImprovement: 1500,
};
