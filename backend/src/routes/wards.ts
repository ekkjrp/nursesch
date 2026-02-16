import { Router } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const wardRouter = Router();

wardRouter.use(authMiddleware);

// GET /api/wards — 병동 목록
wardRouter.get('/', async (_req, res) => {
  try {
    const wards = await prisma.ward.findMany({
      include: { _count: { select: { nurses: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(wards);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// GET /api/wards/:id — 병동 상세
wardRouter.get('/:id', async (req, res) => {
  try {
    const ward = await prisma.ward.findUnique({
      where: { id: Number(req.params.id) },
      include: { nurses: { select: { id: true, name: true, email: true, role: true, skillLevel: true } }, rule: true },
    });
    if (!ward) return res.status(404).json({ error: '병동을 찾을 수 없습니다' });
    res.json(ward);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// POST /api/wards — 병동 생성
wardRouter.post('/', adminOnly, async (req, res) => {
  try {
    const ward = await prisma.ward.create({ data: { name: req.body.name } });
    // 기본 규칙도 함께 생성
    await prisma.rule.create({ data: { wardId: ward.id } });
    res.status(201).json(ward);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// PUT /api/wards/:id — 병동 수정
wardRouter.put('/:id', adminOnly, async (req, res) => {
  try {
    const ward = await prisma.ward.update({
      where: { id: Number(req.params.id) },
      data: { name: req.body.name },
    });
    res.json(ward);
  } catch { res.status(500).json({ error: '서버 오류' }); }
});

// DELETE /api/wards/:id — 병동 삭제
wardRouter.delete('/:id', adminOnly, async (req, res) => {
  try {
    await prisma.ward.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: '서버 오류' }); }
});
