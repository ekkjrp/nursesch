import { Router } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const holidayRouter = Router();

holidayRouter.use(authMiddleware);

// GET /api/holidays?wardId=1 — 공휴일 목록
holidayRouter.get('/', async (req, res) => {
  try {
    const where: any = {};
    if (req.query.wardId) where.wardId = Number(req.query.wardId);
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
    res.json(holidays);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// POST /api/holidays — 공휴일 등록
holidayRouter.post('/', adminOnly, async (req, res) => {
  try {
    const holiday = await prisma.holiday.create({ data: req.body });
    res.status(201).json(holiday);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// DELETE /api/holidays/:id — 공휴일 삭제
holidayRouter.delete('/:id', adminOnly, async (req, res) => {
  try {
    await prisma.holiday.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
