import { Router } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const shiftRequestRouter = Router();

shiftRequestRouter.use(authMiddleware);

// GET /api/shift-requests?scheduleId=1 — 근무 요청 목록
shiftRequestRouter.get('/', async (req, res) => {
  try {
    const where: any = {};
    if (req.query.scheduleId) where.scheduleId = Number(req.query.scheduleId);
    if (req.query.nurseId) where.nurseId = Number(req.query.nurseId);

    const requests = await prisma.shiftRequest.findMany({
      where,
      include: { nurse: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });
    res.json(requests);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// POST /api/shift-requests — 근무 요청 제출 (FR-7.1, FR-7.2: 월 최대 2건)
shiftRequestRouter.post('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const { scheduleId, date, requestedShiftType, reason } = req.body;

    // 월 최대 2건 제한 검사
    const existingCount = await prisma.shiftRequest.count({
      where: { nurseId: user.nurseId, scheduleId },
    });
    if (existingCount >= 2) {
      return res.status(400).json({ error: '월 최대 2건의 요청만 가능합니다' });
    }

    const request = await prisma.shiftRequest.create({
      data: {
        nurseId: user.nurseId,
        scheduleId,
        date,
        requestedShiftType,
        reason,
      },
    });
    res.status(201).json(request);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// PUT /api/shift-requests/:id/approve — 요청 승인 (FR-7.3)
shiftRequestRouter.put('/:id/approve', adminOnly, async (req, res) => {
  try {
    const request = await prisma.shiftRequest.update({
      where: { id: Number(req.params.id) },
      data: { status: 'APPROVED' },
    });
    res.json(request);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// PUT /api/shift-requests/:id/reject — 요청 반려 (FR-7.3)
shiftRequestRouter.put('/:id/reject', adminOnly, async (req, res) => {
  try {
    const request = await prisma.shiftRequest.update({
      where: { id: Number(req.params.id) },
      data: { status: 'REJECTED' },
    });
    res.json(request);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// DELETE /api/shift-requests/:id — 요청 삭제
shiftRequestRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.shiftRequest.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
