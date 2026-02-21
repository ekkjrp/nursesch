# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

`nursesch/` 폴더는 **병원 간호사를 위한 근무 일정표(근무표)를 자동으로 생성해 주는 웹서비스** 프로젝트이다. Simulated Annealing 알고리즘 기반의 스케줄링 엔진으로 하드/소프트 제약을 준수하는 최적 근무표를 생성한다. 알고리즘 설계는 `간호사_근무표_생성을_위한_알고리즘.pdf`에 정의되어 있다.

## 요구사항 문서

- 상세 설계 요구사항: `./designreq.md` (v1.2)
- **코드를 생성할 경우 반드시 위 문서의 요구사항에 맞게 작성**해야 한다.

## 기술 스택

| 계층 | 기술 |
|------|------|
| **Frontend** | React 19 + TypeScript + Vite (port 5173) |
| **Design** | "Daylight Glass" Theme (Light/Transparent) |
| **Backend** | Python FastAPI + uvicorn (port 3000) |
| **ORM** | SQLAlchemy |
| **DB** | SQLite (`backend_py/nursesch.db`) |
| **인증** | JWT (python-jose) + bcrypt |
| **Python** | Anaconda 3.13 (`C:/ProgramData/Anaconda3/python.exe`) |

## 프로젝트 구조

```
nursesch/
├── CLAUDE.md
├── designreq.md          # 상세 설계 요구사항
├── requirements.md        # 기능 요구사항
├── package.json           # 루트 (npm run dev로 프론트+백엔드 동시 실행)
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api.ts         # REST API 클라이언트
│   │   ├── context/AuthContext.tsx
│   │   ├── components/Layout.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── NursesPage.tsx
│   │   │   ├── RulesPage.tsx
│   │   │   ├── SchedulePage.tsx       # 근무표 목록/생성
│   │   │   ├── ScheduleViewPage.tsx   # 근무표 상세 조회/수정
│   │   │   ├── RequestsPage.tsx
│   │   │   └── StatsPage.tsx
│   │   └── styles/global.css
│   └── vite.config.ts     # /api → localhost:3000 프록시
├── backend_py/
│   ├── app/
│   │   ├── main.py         # FastAPI 앱 (redirect_slashes=False)
│   │   ├── auth.py          # JWT + bcrypt 인증
│   │   ├── database.py      # SQLAlchemy 세션
│   │   ├── models.py        # ORM 모델
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── wards.py
│   │   │   ├── nurses.py
│   │   │   ├── rules.py
│   │   │   ├── schedules.py
│   │   │   ├── shift_requests.py
│   │   │   ├── leaves.py
│   │   │   ├── holidays.py
│   │   │   └── logs.py           # 페이지 뷰 로깅
│   │   └── engine/
│   │       ├── scheduler.py   # SA 스케줄링 엔진
│   │       └── validator.py   # 제약 조건 검증기
│   ├── seed.py              # 시드 데이터 생성
│   ├── migrate_v12.py       # v1.2 마이그레이션 스크립트
│   └── nursesch.db          # SQLite DB 파일
└── 간호사_근무표_생성을_위한_알고리즘.pdf
```

## 개발 명령어

```bash
# 프론트엔드 의존성 설치
npm install

# Python 백엔드 의존성 설치
C:/ProgramData/Anaconda3/python.exe -m pip install fastapi uvicorn sqlalchemy python-jose bcrypt python-multipart openpyxl holidays

# 시드 데이터 생성 (초기 1회)
cd backend_py && C:/ProgramData/Anaconda3/python.exe seed.py

# 개발 서버 실행 (백엔드 + 프론트엔드 동시)
npm run dev

# 백엔드만 실행 (port 3000)
npm run dev:backend
# 또는 직접 실행:
cd backend_py && C:/ProgramData/Anaconda3/python.exe -m uvicorn app.main:app --reload --port 3000

# 프론트엔드만 실행 (port 5173)
npm run dev:frontend
```

### 개발용 로그인 계정
- **관리자**: `admin@hospital.com` / `password123` (HN, 수간호사)
- **일반 간호사**: `nurse1@hospital.com` ~ `nurse9@hospital.com` / `password123`
- **임시 간호사**: `nurse10@hospital.com` / `password123` (PN, 임시간호사)

## 아키텍처 개요

```
[React SPA] --/api--> [Vite Proxy] --> [FastAPI :3000] --> [SQLAlchemy] --> [SQLite]
                                              │
                                     ┌────────┴────────┐
                                     │  Engine Layer    │
                                     │  - scheduler.py  │  ← Simulated Annealing
                                     │  - validator.py  │  ← 제약 조건 검증
                                     └─────────────────┘
```

핵심 레이어:
- **UI Layer** (`frontend/`) — React SPA. 근무표 입력/조회, 간호사 관리, 규칙 설정, 통계
- **API Layer** (`backend_py/app/routes/`) — FastAPI REST API. JWT 인증, CRUD 엔드포인트
- **Scheduling Engine** (`backend_py/app/engine/scheduler.py`) — SA 알고리즘 기반 자동 배정. Phase A (HN/CN/RN, D/E/N) + Phase B (AN, M) 분리 생성. PN 제외. 선호도 반영 초기해 + 위반 지향 이웃해 생성
- **Constraint Validator** (`backend_py/app/engine/validator.py`) — 하드/소프트 제약 검증 (엔진과 분리된 독립 모듈)
- **Persistence Layer** (`backend_py/app/models.py`) — SQLAlchemy ORM, SQLite

### 주요 기술적 특이사항
- FastAPI에 `redirect_slashes=False` 설정 (Vite 프록시 Authorization 헤더 유실 방지)
- JWT `sub` 클레임은 반드시 **문자열** (python-jose 요구사항), 생성 시 `str(nurse.id)`, 디코드 시 `int(sub)`
- Python 3.13에서 passlib 호환 불가 → bcrypt 직접 사용

## 도메인 컨텍스트

### 간호사 직급 (Grade)

| 코드 | 명칭 | 역할 | 스케줄링 역할 |
|------|------|------|---------------|
| `HN` | 수간호사 | 관리자 (ADMIN) | Charge |
| `CN` | 책임간호사 | — | Charge |
| `RN` | 평간호사 | — | Action |
| `AN` | 보조간호사 | — | Mid 전담, 주말 자동 Off |
| `PN` | 임시간호사 | — | 스케줄링 제외, 승인 요청만 반영 |

- **Charge 등급** (`HN`, `CN`): 근무조 책임자 역할. 각 근무(D/E/N)에 최소 1명 필요. HN은 자동 D 지정.
- **Action 등급** (`RN`): 실무 담당. 각 근무에 최소 인원 필요.
- **지정근무**: `dedicated_shift` 설정된 간호사는 해당 근무/O만 배정 가능. (기존 `is_night_dedicated`는 deprecated)
- **PN 간호사**: 스케줄링에서 완전 제외. 모든 날짜 O, 승인된 요청만 반영.

### 근무 유형 (Shift Types)

| 코드 | 명칭 | 비고 |
|------|------|------|
| `D` | 데이 (Day) | 주간 근무 |
| `E` | 이브닝 (Evening) | 오후~저녁 근무 |
| `N` | 나이트 (Night) | 야간 근무 |
| `M` | 미드 (Mid) | AN 간호사 기본 근무 |
| `O` | 오프 (Off) | 휴무 |
| `Y` | 연차 | 연차 휴가 |
| `X` | 기타 | 교육 등 |

- **실근무(WORK_SHIFTS)**: `D`, `E`, `N`, `M`
- 비근무: `O`, `Y`, `X`

### 제약 조건 분류

**하드 제약 (Hard Constraints)** — 위반 시 페널티 1000점/건:

| 코드 | 규칙 | 설명 |
|------|------|------|
| HC-1 | 근무조별 인원 충족 | 각 날짜·근무(D/E/N)별 Charge/Action 최소 인원 보장 |
| HC-2 | 최대 연속 근무일 | 기본 5일, 규칙 설정에서 변경 가능 |
| HC-3 | 금지 전환 패턴 | N→D, N→E, N→O→D 금지 (설정으로 허용 가능) |
| HC-4 | 나이트 연속 제한 | 단독 1일 금지, 연속 4일 이상 금지 (2~3일만 허용) |
| HC-5 | 지정근무 준수 | 지정근무 간호사는 해당 근무/O/Y/X만 배정 (HN 자동 D 포함) |
| HC-6 | AN 주말 자동 Off | AN 간호사 주말 근무 금지 (설정으로 비활성화 가능) |
| HC-7 | 월간 최대 나이트 | 월간 나이트 횟수 상한 초과 금지 (0=무제한) |

**소프트 제약 (Soft Constraints)** — 위반 시 가중 페널티:

| 코드 | 규칙 | 설명 |
|------|------|------|
| SC-1 | 개인 선호도 | 희망 휴무일 반영 |
| SC-2 | 근무 횟수 균등 | 간호사 간 총 근무일수 표준편차 × 50 페널티 |

### 비근무일 계산
총 비근무일수 = 주말일수 + 공휴일수(주말 제외) + 개인 연차수
- `total_off_days_override`가 설정되면 자동 계산 대신 해당 값을 사용

### SA 알고리즘 파라미터
- 초기 온도: 1000.0, 냉각률: 0.9993
- 최대 반복: 15,000회, 무개선 한계: 1,500회 (재가열)
- 하드 제약 0점 달성 시 조기 종료
- 초기해: 커버리지 우선 배정 (날짜별 최소 Charge/Action 보장)
- 이웃해: 50% 위반 해소 지향 + 50% 랜덤 스왑

## 코드 작성 규칙

### 언어 및 주석
- 코드 식별자(변수명, 함수명 등)는 영문을 사용한다.
- 주석은 **영문과 한글을 적절히 혼용**하여 코드의 의도와 비즈니스 로직을 명확히 설명한다.
- 복잡한 스케줄링 규칙, 제약 조건, 도메인 지식은 한글 주석으로 설명한다.

### 코드 스타일
- 변수명, 함수명은 그 역할이 명확히 드러나도록 서술적으로 작성한다.
- 한 함수는 하나의 명확한 역할만 수행하도록 작성한다.

### 테스트
- 단계별 테스트: 단위 테스트(unit) → 통합 테스트(integration) → 시나리오 테스트(e2e) 순으로 검증한다.
- 스케줄링 알고리즘은 제약 조건 충족 여부를 검증하는 테스트 케이스를 반드시 포함한다.
