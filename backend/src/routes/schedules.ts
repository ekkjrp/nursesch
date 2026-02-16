import { Router } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { generateSchedule } from '../engine/scheduler.js';
import { validateSchedule } from '../engine/validator.js';
import { exportToExcel } from '../utils/excel.js';
import type { ShiftType } from '@nursesch/shared';

export const scheduleRouter = Router();

scheduleRouter.use(authMiddleware);

// GET /api/schedules?wardId=1 — 근무표 목록 조회
scheduleRouter.get('/', async (req, res) => {
  try {
    const where: any = {};
    if (req.query.wardId) where.wardId = Number(req.query.wardId);
    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { yearMonth: 'desc' },
    });
    res.json(schedules);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// GET /api/schedules/:id — 근무표 상세 (엔트리 포함)
scheduleRouter.get('/:id', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        entries: { orderBy: [{ nurseId: 'asc' }, { date: 'asc' }] },
        shiftRequests: true,
      },
    });
    if (!schedule) return res.status(404).json({ error: '근무표를 찾을 수 없습니다' });
    res.json(schedule);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// POST /api/schedules/generate — 근무표 자동 생성 (FR-5)
scheduleRouter.post('/generate', adminOnly, async (req, res) => {
  try {
    const { wardId, yearMonth } = req.body;

    // 병동 정보, 규칙, 간호사 목록 조회
    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
      include: { nurses: true, rule: true, holidays: true },
    });
    if (!ward || !ward.rule) {
      return res.status(400).json({ error: '병동 또는 규칙이 존재하지 않습니다' });
    }

    // 승인된 근무 요청 조회
    const approvedRequests = await prisma.shiftRequest.findMany({
      where: {
        nurseId: { in: ward.nurses.map(n => n.id) },
        schedule: { yearMonth },
        status: 'APPROVED',
      },
    });

    // 이전 달 근무표 조회 (연속성 보장 - FR-5.4)
    const [year, month] = yearMonth.split('-').map(Number);
    const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
    const prevSchedule = await prisma.schedule.findFirst({
      where: { wardId, yearMonth: prevMonth },
      include: { entries: true },
    });

    // SA 알고리즘으로 스케줄 생성
    const rule = {
      ...ward.rule,
      constraintWeights: JSON.parse(ward.rule.constraintWeights || '{}'),
    };

    const result = generateSchedule({
      nurses: ward.nurses,
      rule,
      yearMonth,
      holidays: ward.holidays.map(h => h.date),
      shiftRequests: approvedRequests,
      prevMonthEntries: prevSchedule?.entries || [],
    });

    // 기존 DRAFT 근무표가 있으면 삭제
    const existing = await prisma.schedule.findFirst({
      where: { wardId, yearMonth, status: 'DRAFT' },
    });
    if (existing) {
      await prisma.schedule.delete({ where: { id: existing.id } });
    }

    // 새 근무표 저장
    const schedule = await prisma.schedule.create({
      data: {
        wardId,
        yearMonth,
        status: 'DRAFT',
        entries: {
          create: result.entries.map(e => ({
            nurseId: e.nurseId,
            date: e.date,
            shiftType: e.shiftType,
          })),
        },
      },
      include: { entries: true },
    });

    res.status(201).json({
      schedule,
      score: result.score,
      violations: result.violations,
    });
  } catch (err) {
    console.error('Schedule generation failed:', err);
    res.status(500).json({ error: '근무표 생성 실패' });
  }
});

// PUT /api/schedules/:id/entry — 개별 셀 수정 (FR-6.2)
scheduleRouter.put('/:id/entry', adminOnly, async (req, res) => {
  try {
    const { nurseId, date, shiftType } = req.body;
    const scheduleId = Number(req.params.id);

    const entry = await prisma.scheduleEntry.upsert({
      where: { scheduleId_nurseId_date: { scheduleId, nurseId, date } },
      update: { shiftType, isManuallyEdited: true },
      create: { scheduleId, nurseId, date, shiftType, isManuallyEdited: true },
    });

    // 수정 후 제약 조건 검증 (FR-6.3)
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { entries: true, ward: { include: { rule: true, nurses: true, holidays: true } } },
    });

    let validation = null;
    if (schedule?.ward?.rule) {
      const rule = {
        ...schedule.ward.rule,
        constraintWeights: JSON.parse(schedule.ward.rule.constraintWeights || '{}'),
      };
      validation = validateSchedule(
        schedule.entries,
        schedule.ward.nurses,
        rule,
        schedule.yearMonth,
        schedule.ward.holidays.map(h => h.date),
      );
    }

    res.json({ entry, validation });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// PUT /api/schedules/:id/confirm — 근무표 확정 (FR-6.4)
scheduleRouter.put('/:id/confirm', adminOnly, async (req, res) => {
  try {
    const schedule = await prisma.schedule.update({
      where: { id: Number(req.params.id) },
      data: { status: 'CONFIRMED' },
    });
    res.json(schedule);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// GET /api/schedules/:id/validate — 근무표 검증
scheduleRouter.get('/:id/validate', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: Number(req.params.id) },
      include: { entries: true, ward: { include: { rule: true, nurses: true, holidays: true } } },
    });
    if (!schedule?.ward?.rule) return res.status(404).json({ error: '근무표를 찾을 수 없습니다' });

    const rule = {
      ...schedule.ward.rule,
      constraintWeights: JSON.parse(schedule.ward.rule.constraintWeights || '{}'),
    };
    const validation = validateSchedule(
      schedule.entries,
      schedule.ward.nurses,
      rule,
      schedule.yearMonth,
      schedule.ward.holidays.map(h => h.date),
    );
    res.json(validation);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// GET /api/schedules/:id/export — Excel 내보내기 (FR-5.7)
scheduleRouter.get('/:id/export', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        entries: { orderBy: [{ nurseId: 'asc' }, { date: 'asc' }] },
        ward: { include: { nurses: true } },
      },
    });
    if (!schedule) return res.status(404).json({ error: '근무표를 찾을 수 없습니다' });

    const buffer = exportToExcel(schedule, schedule.ward!.nurses);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=schedule_${schedule.yearMonth}.xlsx`);
    res.send(buffer);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// GET /api/schedules/:id/stats — 통계 (FR-8)
scheduleRouter.get('/:id/stats', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        entries: true,
        ward: { include: { nurses: true } },
        shiftRequests: { where: { status: 'APPROVED' } },
      },
    });
    if (!schedule) return res.status(404).json({ error: '근무표를 찾을 수 없습니다' });

    const nurses = schedule.ward!.nurses;
    const stats = nurses.map(nurse => {
      const nurseEntries = schedule.entries.filter(e => e.nurseId === nurse.id);
      const counts: Record<string, number> = { D: 0, E: 0, N: 0, O: 0, X: 0 };
      let weekendWorkDays = 0;

      nurseEntries.forEach(entry => {
        counts[entry.shiftType] = (counts[entry.shiftType] || 0) + 1;
        const dayOfWeek = new Date(entry.date).getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && entry.shiftType !== 'O' && entry.shiftType !== 'X') {
          weekendWorkDays++;
        }
      });

      // 요청 반영률 계산
      const nurseRequests = schedule.shiftRequests.filter(r => r.nurseId === nurse.id);
      const fulfilled = nurseRequests.filter(r =>
        nurseEntries.some(e => e.date === r.date && e.shiftType === r.requestedShiftType)
      );

      return {
        nurseId: nurse.id,
        nurseName: nurse.name,
        shiftCounts: counts,
        totalWorkDays: counts.D + counts.E + counts.N,
        offDays: counts.O,
        weekendWorkDays,
        requestCount: nurseRequests.length,
        requestFulfilled: fulfilled.length,
      };
    });

    res.json(stats);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
