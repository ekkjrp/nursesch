# 기능 요구사항 (Requirements)

> designreq.md의 상세 설계를 기반으로 구현된 기능 목록

## 구현 완료

### FR-1: 병동/간호사 관리
- [x] 병동 CRUD (생성/조회/수정/삭제)
- [x] 간호사 CRUD (등록/조회/수정/삭제)
- [x] 간호사 숙련도 등급 (JUNIOR/SENIOR/CHARGE)
- [x] 역할 기반 접근 제어 (ADMIN/NURSE)

### FR-2: 근무표 기본 설정
- [x] 스케줄 대상 연월 선택
- [x] 평일/주말별 근무 유형별 필요 인원 설정
- [x] 이전 달 근무표 참조 (연속성 보장)

### FR-3: 근무 규칙 설정
- [x] 최대 연속 근무일 수 설정
- [x] 최대 연속 야간근무 수 설정
- [x] 월간 최소 휴무일 수 설정
- [x] 근무 전환 규칙 토글 (N→D, N→E, NOD)
- [x] 병동별 독립 규칙 설정

### FR-4: 제약 조건 관리
- [x] 하드/소프트 제약 분류
- [x] 병동별 가중치 설정 (constraintWeights JSON)
- [x] 실시간 제약 위반 검증 (validate API)

### FR-5: 자동 근무표 생성
- [x] Simulated Annealing 알고리즘 구현
- [x] 하드 제약 100% 충족
- [x] 소프트 제약 가중치 기반 최적화
- [x] 이전 달 근무표 연속성 보장
- [x] Excel 내보내기

### FR-6: 근무표 조회/수정
- [x] 테이블 형태 조회 (행: 간호사, 열: 날짜)
- [x] 개별 셀 수동 수정
- [x] 수정 시 실시간 제약 검증 + 경고 표시
- [x] 근무표 확정 기능

### FR-7: 개인 선호도/근무 요청
- [x] 간호사 근무/휴무 요청 제출
- [x] 월 최대 2건 제한
- [x] 관리자 승인/반려
- [x] 승인된 요청 자동 생성 시 반영

### FR-8: 통계 및 공정성 대시보드
- [x] 간호사별 근무 유형별 횟수 통계
- [x] 월간 휴무일 수
- [x] 주말 근무 횟수 균등 여부
- [x] 요청 반영률
- [x] 근무 분포 시각화 (바 차트)

## 기술 스택
- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Database: SQLite (Prisma ORM)
- Algorithm: Simulated Annealing (SA)
- Auth: JWT
