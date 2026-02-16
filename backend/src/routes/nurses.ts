import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const nurseRouter = Router();

nurseRouter.use(authMiddleware);

// GET /api/nurses?wardId=1 — 간호사 목록
nurseRouter.get('/', async (req, res) => {
  try {
    const where = req.query.wardId ? { wardId: Number(req.query.wardId) } : {};
    const nurses = await prisma.nurse.findMany({
      where,
      select: { id: true, wardId: true, name: true, email: true, role: true, skillLevel: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(nurses);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// POST /api/nurses — 간호사 등록
nurseRouter.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, role, skillLevel, wardId, password } = req.body;
    const passwordHash = await bcrypt.hash(password || 'changeme123', 10);
    const nurse = await prisma.nurse.create({
      data: { name, email, role: role || 'NURSE', skillLevel: skillLevel || 'SENIOR', wardId, passwordHash },
      select: { id: true, wardId: true, name: true, email: true, role: true, skillLevel: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json(nurse);
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(400).json({ error: '이미 등록된 이메일입니다' });
    res.status(500).json({ error: '서버 오류' });
  }
});

// PUT /api/nurses/:id — 간호사 수정
nurseRouter.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, role, skillLevel, wardId } = req.body;
    const nurse = await prisma.nurse.update({
      where: { id: Number(req.params.id) },
      data: { name, email, role, skillLevel, wardId },
      select: { id: true, wardId: true, name: true, email: true, role: true, skillLevel: true, createdAt: true, updatedAt: true },
    });
    res.json(nurse);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// DELETE /api/nurses/:id — 간호사 삭제
nurseRouter.delete('/:id', adminOnly, async (req, res) => {
  try {
    await prisma.nurse.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
